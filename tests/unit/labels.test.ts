import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { read, utils } from 'xlsx'
import { checkLabels, splitNames, type LabelItem } from '../../scripts/labels'

// The analysis evaluation's labelling (#129): the handed-out spreadsheets and
// the checks that turn filled ones into labels. All texts are invented.
const items = readFileSync(new URL('../../data/eval/analysis/items.jsonl', import.meta.url), 'utf8')
  .trim().split('\n').map(line => JSON.parse(line) as LabelItem)

const two: LabelItem[] = [
  { id: 'en-001', lang: 'en', split: 'dev', text: 'The bank feed disconnected again.' },
  { id: 'en-002', lang: 'en', split: 'test', text: 'Recurring invoices please.' },
]
const themes = [['job', 'Reconcile bank transactions'], ['pain', 'Bank connection keeps dropping'], ['gain', 'Recurring invoices']]
const row = (id: string, text: string, jobs: string, pains: string, gains: string, sentiment: string, type: string, comment = '') => [id, text, jobs, pains, gains, sentiment, type, comment]

describe('the items', () => {
  it('has 120 invented items per language, 60 dev and 60 test, with unique ids and texts', () => {
    for (const lang of ['en', 'de']) {
      const ofLang = items.filter(item => item.lang === lang)
      expect(ofLang).toHaveLength(120)
      expect(ofLang.filter(item => item.split === 'dev')).toHaveLength(60)
      expect(new Set(ofLang.map(item => item.text)).size).toBe(120)
    }
    expect(new Set(items.map(item => item.id)).size).toBe(240)
  })
})

describe('the labelling spreadsheets', () => {
  for (const [lang, itemsTab, themesTab, guideTab] of [['en', 'Items', 'Themes', 'Guidelines'], ['de', 'Einträge', 'Themen', 'Anleitung']] as const) {
    it(`labelling-${lang}.xlsx opens on the guidelines, holds every ${lang} item as handed out, and is not labelled`, () => {
      const book = read(readFileSync(new URL(`../../data/eval/analysis/labelling-${lang}.xlsx`, import.meta.url)))
      expect(book.SheetNames).toEqual([guideTab, itemsTab, themesTab])
      const rows = utils.sheet_to_json<string[]>(book.Sheets[itemsTab]!, { header: 1, raw: false, defval: '' }).slice(1)
      const expected = items.filter(item => item.lang === lang)
      expect(rows.map(cells => [cells[0], cells[1]])).toEqual(expected.map(item => [item.id, item.text]))
      expect(rows.every(cells => cells.slice(2).every(cell => cell === ''))).toBe(true)
      // The split is not handed out.
      expect(JSON.stringify(utils.sheet_to_json(book.Sheets[itemsTab]!))).not.toMatch(/\b(?:dev|test)\b/)
    })
  }
})

describe('splitNames', () => {
  it('splits on semicolons and line breaks, and tidies spaces', () => {
    expect(splitNames('Recurring invoices;  Bank   sync\nDark mode;;')).toEqual(['Recurring invoices', 'Bank sync', 'Dark mode'])
    expect(splitNames('')).toEqual([])
  })
})

describe('checkLabels', () => {
  it('turns filled rows into labels, with names written as on the themes tab and counted once', () => {
    const { labels, findings } = checkLabels(two, [
      row('en-001', two[0]!.text, 'reconcile bank transactions', 'Bank connection keeps dropping', '', 'Negative', 'bug'),
      row('en-002', two[1]!.text, '', '', 'Recurring invoices; recurring INVOICES', 'neutral', 'feature request', 'short'),
    ], themes)
    expect(findings).toEqual([])
    expect(labels).toEqual([
      { id: 'en-001', lang: 'en', split: 'dev', jobs: ['Reconcile bank transactions'], pains: ['Bank connection keeps dropping'], gains: [], sentiment: 'negative', type: 'bug' },
      { id: 'en-002', lang: 'en', split: 'test', jobs: [], pains: [], gains: ['Recurring invoices'], sentiment: 'neutral', type: 'feature request', comment: 'short' },
    ])
  })

  it('flags missing and invalid values, names not on the themes tab, placeholders, changed text, and missing or unknown rows', () => {
    const { findings } = checkLabels(two, [
      row('en-001', 'The bank feed disconnected.', 'Run payroll', 'Bank connection keeps dropping', '', '', 'rant'),
      row('en-999', 'Invented.', '', '', '', 'neutral', 'other'),
    ], [...themes, ['pain', 'Calls from [NAME_1]'], ['feeling', 'Anything']])
    const messages = findings.filter(finding => finding.level === 'problem').map(finding => `${finding.where}: ${finding.message}`)
    expect(messages).toEqual(expect.arrayContaining([
      'themes, row 6: kind "feeling" must be one of: job, pain, gain',
      'row 2 (en-001): the text was changed; it must stay as handed out',
      'row 2 (en-001): job "Run payroll" is not on the themes tab as a job',
      'row 2 (en-001): sentiment is missing',
      'row 2 (en-001): type "rant" must be one of: bug, feature request, question, praise, complaint, other',
      'row 3 (en-999): unknown id "en-999"',
      'en-002: this item is missing from the sheet',
    ]))
    const placeholder = checkLabels(two, [row('en-001', two[0]!.text, '', 'Calls from [NAME_1]', '', 'negative', 'bug')], [['pain', 'Calls from [NAME_1]']])
    expect(placeholder.findings.map(finding => finding.message)).toContain('pain "Calls from [NAME_1]" contains a placeholder')
  })

  it('notes theme names that no item uses, without stopping', () => {
    const { findings } = checkLabels(two.slice(0, 1), [row('en-001', two[0]!.text, '', '', '', 'neutral', 'other')], themes)
    expect(findings.every(finding => finding.level === 'note')).toBe(true)
    expect(findings.map(finding => finding.message).join(' ')).toContain('Recurring invoices')
  })
})
