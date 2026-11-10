import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Detection } from '../../core/detect/types'
import { accuracyData, covers, currentTables, evaluate, nameRecallByGroup, nameTables, withAccuracy, type EvalItem, type Mistake } from '../../scripts/eval'

describe('covers', () => {
  it('needs the ranges to reach from start to end without a gap', () => {
    expect(covers([{ start: 0, end: 10 }], 2, 8)).toBe(true)
    expect(covers([{ start: 0, end: 4 }, { start: 4, end: 10 }], 0, 10)).toBe(true)
    expect(covers([{ start: 0, end: 4 }, { start: 5, end: 10 }], 0, 10)).toBe(false)
    expect(covers([{ start: 3, end: 10 }], 0, 10)).toBe(false)
    expect(covers([], 0, 1)).toBe(false)
  })
})

describe('evaluate', () => {
  const item: EvalItem = {
    id: 'x',
    lang: 'de',
    text: 'Mail anna@example.com, IBAN AT61 1904 3002 3457 3201, Anna',
    spans: [
      { start: 5, end: 21, type: 'EMAIL', text: 'anna@example.com' },
      { start: 28, end: 52, type: 'IBAN', text: 'AT61 1904 3002 3457 3201' },
      { start: 54, end: 58, type: 'NAME', text: 'Anna' },
    ],
  }
  const found = (type: Detection['type'], start: number, end: number): Detection => ({ type, start, end, value: item.text.slice(start, end) })

  it('counts a value as found only when its own type covers all of it, and as removed when any type does', () => {
    const mistakes: Mistake[] = []
    // The email is only half covered; the IBAN is covered, but as a phone number.
    const scores = evaluate([item], () => [found('EMAIL', 5, 12), found('PHONE', 28, 52)], mistakes)
    expect(scores.byType.get('EMAIL')!.de).toEqual({ labelled: 1, found: 0, detected: 1, correct: 1 })
    expect(scores.byType.get('IBAN')!.de).toEqual({ labelled: 1, found: 0, detected: 0, correct: 0 })
    expect(scores.byType.get('PHONE')!.de).toEqual({ labelled: 0, found: 0, detected: 1, correct: 0 })
    expect(scores.anyType.de).toEqual({ labelled: 3, found: 1, detected: 2, correct: 2 })
    expect(mistakes.map(mistake => `${mistake.kind} ${mistake.type}`)).toEqual(['missed EMAIL', 'missed IBAN', 'missed NAME', 'wrong PHONE'])
  })

  it('reports the other language separately', () => {
    const scores = evaluate([{ ...item, lang: 'en' }], () => [])
    expect(scores.byType.get('EMAIL')!.de.labelled).toBe(0)
    expect(scores.byType.get('EMAIL')!.en.labelled).toBe(1)
  })
})

describe('nameRecallByGroup', () => {
  const items: EvalItem[] = [
    { id: 'a', lang: 'de', group: 'turkish', split: 'test', text: 'Danke, Ayşe Yılmaz!', spans: [{ start: 7, end: 18, type: 'NAME', text: 'Ayşe Yılmaz' }] },
    { id: 'b', lang: 'en', group: 'turkish', split: 'test', text: 'Thanks Emre', spans: [{ start: 7, end: 11, type: 'NAME', text: 'Emre' }] },
    { id: 'c', lang: 'en', group: 'polish', split: 'test', text: 'Ask Zofia Woźniak', spans: [{ start: 4, end: 17, type: 'NAME', text: 'Zofia Woźniak' }] },
  ]

  it('counts a name as found only when NAME detections cover all of it, per group and language', () => {
    // Ayşe Yılmaz is covered, Emre is not detected, and only "Zofia" of Zofia Woźniak is covered.
    const find = (text: string): Detection[] => text.startsWith('Danke')
      ? [{ type: 'NAME', start: 7, end: 18, value: 'Ayşe Yılmaz' }]
      : text.startsWith('Ask') ? [{ type: 'NAME', start: 4, end: 9, value: 'Zofia' }] : []
    const results = nameRecallByGroup(items, find)
    expect(results).toEqual([
      { group: 'turkish', scores: { de: { labelled: 1, found: 1 }, en: { labelled: 1, found: 0 } } },
      { group: 'polish', scores: { de: { labelled: 0, found: 0 }, en: { labelled: 1, found: 0 } } },
    ])
  })

  it('counts a name labelled as a place as removed, but not as type-correct', () => {
    const asPlace = (text: string): Detection[] => text.startsWith('Danke') ? [{ type: 'PLACE', start: 7, end: 18, value: 'Ayşe Yılmaz' }] : []
    expect(nameRecallByGroup(items, asPlace)[0]!.scores.de).toEqual({ labelled: 1, found: 0 })
    expect(nameRecallByGroup(items, asPlace, { anyType: true })[0]!.scores.de).toEqual({ labelled: 1, found: 1 })
  })

  it('reports removal, type-correct and without-the-list recall per language and group, and the list overlap', () => {
    const all = (text: string): Detection[] => text.startsWith('Danke')
      ? [{ type: 'PLACE', start: 7, end: 18, value: 'Ayşe Yılmaz' }]
      : text.startsWith('Thanks') ? [{ type: 'NAME', start: 7, end: 11, value: 'Emre' }] : []
    const withoutList = (text: string) => all(text).filter(found => found.value !== 'Emre')
    const tables = nameTables(items, all, withoutList)
    expect(tables).toContain('| DE | 1.00 | 0.00 | 1.00 | 1 |')
    expect(tables).toContain('| EN | 0.50 (below target) | 0.50 | 0.00 | 2 |')
    expect(tables).toContain('| Turkish | 1.00 | 0.00 | 1.00 | 1.00 | 1.00 | 0.00 | 1.00 | 0.50 | 0.50 | 2 |')
    expect(tables).toContain('3 of 3 test names contain a first name from the list.')
  })
})

describe('published numbers', () => {
  it('docs/accuracy.md shows the numbers the detectors reach today (run `npm run eval -- --write` after changing a detector)', () => {
    const page = readFileSync(new URL('../../docs/accuracy.md', import.meta.url), 'utf8')
    expect(withAccuracy(page, currentTables())).toBe(page)
  })

  it('the Accuracy page\'s data is the same eval output (run `npm run eval -- --write`)', () => {
    const data = JSON.parse(readFileSync(new URL('../../data/eval/accuracy.json', import.meta.url), 'utf8'))
    expect(data).toEqual(JSON.parse(JSON.stringify(accuracyData())))
  })
})
