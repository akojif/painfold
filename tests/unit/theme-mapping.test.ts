import { describe, expect, it } from 'vitest'
import { read, utils, write, type WorkBook } from 'xlsx'
import type { Kind } from '../../core/ai/merge'
import type { Theme } from '../../core/ai/themes'
import type { ItemLabels } from '../../scripts/labels'
import { goldNames, mappingRows, mappingWorkbook, readMapping, type MappingRow } from '../../scripts/theme-mapping'

// The theme mapping (#129): a sheet per language, filled in by a person, read
// back with every row checked. Names and quotes are invented.
const theme = (kind: Kind, name: string, count: number, quotes: string[] = []): Theme => ({
  kind, name, labels: [name], items: [], count, share: 0, intensity: 2, confidence: 'enough',
  quotes: quotes.map((quote, index) => ({ item: `i${index}`, quote, intensity: 2 })),
  sentiment: { positive: 0, negative: 0, mixed: 0, neutral: 0 },
  types: { 'bug': 0, 'feature request': 0, 'question': 0, 'praise': 0, 'complaint': 0, 'other': 0 },
})
const counted: Record<Kind, Theme[]> = {
  jobs: [theme('jobs', 'Invoicing', 2, ['I send invoices', 'Invoicing is fine', 'a third quote'])],
  pains: [theme('pains', 'Bank connection', 3), theme('pains', 'Late payments', 1), theme('pains', 'Bank connection', 1)],
  gains: [theme('gains', 'Reminder schedule', 1)],
}
const label = (id: string, jobs: string[], pains: string[], gains: string[]): ItemLabels => ({ id, lang: 'en', split: 'test', jobs, pains, gains, sentiment: 'neutral', type: 'other' })
const gold = goldNames([label('a', ['Send invoices'], ['Bank feed drops'], []), label('b', ['Send invoices'], ['Slow payroll'], ['Custom reminders'])])
const RUN = 'test-en-claude-haiku-5-5-2026-11-20T10-00-00Z.json'

/** Writes the sheet to bytes and reads it back, as after a round trip through Excel. */
const roundTrip = (book: WorkBook) => read(write(book, { type: 'buffer', bookType: 'xlsx' }))
/** Fills the sheet like a person: who mapped it, and a gold theme per row. */
function fill(book: WorkBook, tab: string, mappedBy: string, golds: Record<string, string>) {
  const sheet = book.Sheets[tab]!
  const cells = utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  cells[0]![1] = mappedBy
  for (const row of cells.slice(4)) if (row[1]! in golds) row[4] = golds[row[1]!]!
  book.Sheets[tab] = utils.aoa_to_sheet(cells)
  return book
}
const rows: MappingRow[] = mappingRows(counted)

describe('making the sheet', () => {
  it('lists each model theme once, most texts first, with up to two quotes', () => {
    expect(rows).toEqual([
      { kind: 'jobs', theme: 'Invoicing', texts: 2, quotes: ['I send invoices', 'Invoicing is fine'] },
      { kind: 'pains', theme: 'Bank connection', texts: 3, quotes: [] },
      { kind: 'pains', theme: 'Late payments', texts: 1, quotes: [] },
      { kind: 'gains', theme: 'Reminder schedule', texts: 1, quotes: [] },
    ])
  })

  it('lists the gold themes of each kind, sorted', () => {
    expect(gold).toEqual({ jobs: ['Send invoices'], pains: ['Bank feed drops', 'Slow payroll'], gains: ['Custom reminders'] })
  })

  it('is in the language of the run, with the guidelines, the rows and the gold themes', () => {
    expect(roundTrip(mappingWorkbook(RUN, 'en', rows, gold)).SheetNames).toEqual(['Guidelines', 'Mapping', 'Gold themes'])
    const german = roundTrip(mappingWorkbook(RUN, 'de', rows, gold))
    expect(german.SheetNames).toEqual(['Anleitung', 'Zuordnung', 'Gold-Themen'])
    expect(utils.sheet_to_json<string[]>(german.Sheets.Zuordnung!, { header: 1 })[3]).toEqual(['Art', 'Modell-Thema', 'Texte', 'Beispielzitate', 'Gold-Thema', 'Kommentar'])
  })
})

describe('reading it back', () => {
  const filled = () => roundTrip(fill(mappingWorkbook(RUN, 'en', rows, gold), 'Mapping', 'Francis Akoji', {
    'Invoicing': 'send invoices', 'Bank connection': 'Bank feed drops', 'Late payments': 'none', 'Reminder schedule': 'Custom reminders',
  }))

  it('records who mapped it, and maps by meaning, ignoring case; none matches nothing', () => {
    const { stored, findings } = readMapping(filled(), RUN, 'en', rows, gold)
    expect(findings).toEqual([])
    expect(stored).toEqual({
      format: 'painfold-theme-mapping/1',
      run: RUN,
      lang: 'en',
      mappedBy: 'Francis Akoji',
      mapping: {
        jobs: { Invoicing: 'Send invoices' },
        pains: { 'Bank connection': 'Bank feed drops', 'Late payments': null },
        gains: { 'Reminder schedule': 'Custom reminders' },
      },
    })
  })

  it('accepts "keins" in the German sheet', () => {
    const book = roundTrip(fill(mappingWorkbook(RUN, 'de', rows, gold), 'Zuordnung', 'Anna Beispiel', {
      'Invoicing': 'Send invoices', 'Bank connection': 'Bank feed drops', 'Late payments': 'keins', 'Reminder schedule': 'Custom reminders',
    }))
    const { stored } = readMapping(book, RUN, 'de', rows, gold)
    expect(stored?.mappedBy).toBe('Anna Beispiel')
    expect(stored?.mapping.pains['Late payments']).toBeNull()
  })

  it('reports problems instead of guessing, and writes nothing', () => {
    const book = roundTrip(fill(mappingWorkbook(RUN, 'en', rows, gold), 'Mapping', '', {
      'Invoicing': 'Send invoice', 'Bank connection': 'Custom reminders', 'Late payments': '',
    }))
    const { stored, findings } = readMapping(book, RUN, 'en', rows, gold)
    expect(stored).toBeUndefined()
    expect(findings.map(finding => finding.message)).toEqual([
      'write who mapped this language next to "Mapped by"',
      '"Send invoice" is not a gold job theme; copy it from the Gold themes tab, or write none',
      // A gold theme of another kind does not count.
      '"Custom reminders" is not a gold pain theme; copy it from the Gold themes tab, or write none',
      'write a gold theme for "Late payments", or none',
      'write a gold theme for "Reminder schedule", or none',
    ])
  })

  it('notices changed, added or missing rows, and a sheet for another run', () => {
    const book = filled()
    const cells = utils.sheet_to_json<string[]>(book.Sheets.Mapping!, { header: 1, raw: false, defval: '' })
    cells[4]![1] = 'Invoicing, renamed'
    book.Sheets.Mapping = utils.aoa_to_sheet(cells)
    const messages = readMapping(book, 'dev-en-other.json', 'en', rows, gold).findings.map(finding => finding.message)
    expect(messages).toEqual([
      `this sheet is for the run ${RUN}, not dev-en-other.json`,
      '"job Invoicing, renamed" is not a model theme of this run; do not change or add rows',
      'the row for "Invoicing" is missing',
    ])
  })
})
