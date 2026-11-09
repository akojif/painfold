import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Detection } from '../../core/detect/types'
import { covers, currentTables, evaluate, withAccuracy, type EvalItem, type Mistake } from '../../scripts/eval'

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
    expect(scores.anyDetectedType.de).toEqual({ labelled: 2, found: 1, detected: 2, correct: 2 })
    expect(mistakes.map(mistake => `${mistake.kind} ${mistake.type}`)).toEqual(['missed EMAIL', 'missed IBAN', 'missed NAME', 'wrong PHONE'])
  })

  it('reports the other language separately', () => {
    const scores = evaluate([{ ...item, lang: 'en' }], () => [])
    expect(scores.byType.get('EMAIL')!.de.labelled).toBe(0)
    expect(scores.byType.get('EMAIL')!.en.labelled).toBe(1)
  })
})

describe('published numbers', () => {
  it('README.md shows the numbers the detectors reach today (run `npm run eval -- --write` after changing a detector)', () => {
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8')
    expect(withAccuracy(readme, currentTables())).toBe(readme)
  })
})
