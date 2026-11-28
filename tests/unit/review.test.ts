import { describe, expect, it } from 'vitest'
import { at, cellOf, itemsFor, reviewFor } from './review-helpers'
import { OverlapError, Review } from '../../core/review/review'

const rows = [
  ['1', 'Mail anna@example.com, IP 192.0.2.7'],
  ['2', 'Again ANNA@example.com please. Anna Huber called.'],
  ['3', 'Nothing here, but Anna Huber wrote it.'],
  ['4', 'See https://example.com/i/1'],
]
const columns = [1]
const fresh = () => reviewFor(rows, columns)

describe('Review', () => {
  it('lists findings in reading order with placeholders fixed by first appearance', () => {
    const review = fresh()
    expect(review.findings.map(finding => [cellOf(finding).row, finding.type])).toEqual([[0, 'EMAIL'], [0, 'IP'], [1, 'EMAIL'], [3, 'URL']])
    expect(review.findings.map(finding => review.placeholderFor(finding))).toEqual(['[EMAIL_1]', '[IP_1]', '[EMAIL_1]', '[LINK_1]'])
  })

  it('applies a decision to every copy of a value', () => {
    const review = fresh()
    const email = review.findings[0]!
    expect(review.copiesOf(email.key)).toHaveLength(2)
    review.decide(email.key, 'keep')
    expect(review.counts()).toEqual({ total: 4, reviewed: 2, left: 2 })
    expect(review.cleanedItem(at(1, 1))).toBe('Again ANNA@example.com please. Anna Huber called.')
  })

  it('removes undecided findings when cleaning', () => {
    const review = fresh()
    expect(review.cleanedItem(at(0, 1))).toBe('Mail [EMAIL_1], IP [IP_1]')
    // Unchecked cells are not items: the export keeps them as they are (items.test.ts).
    expect(review.items.some(item => item.id === at(0, 0))).toBe(false)
  })

  it('keeps placeholder numbers stable when a value is kept', () => {
    const review = fresh()
    review.decide(review.findings[0]!.key, 'keep')
    expect(review.placeholderFor(review.findings[1]!)).toBe('[IP_1]')
    expect(review.placeholderFor(review.findings[3]!)).toBe('[LINK_1]')
  })

  it('removes everything left in one step that can be undone', () => {
    const review = fresh()
    review.decide(review.findings[1]!.key, 'keep')
    expect(review.removeAllLeft()).toBe(2)
    expect(review.counts().left).toBe(0)
    review.undo()
    expect(review.counts()).toEqual({ total: 4, reviewed: 1, left: 3 })
  })

  it('removes everything left of one type in one step that can be undone', () => {
    const review = fresh()
    expect(review.removeAllLeft('EMAIL')).toBe(1)
    expect(review.findings.map(finding => review.decisionFor(finding.key))).toEqual(['remove', undefined, 'remove', undefined])
    expect(review.removeAllLeft('EMAIL')).toBe(0)
    review.undo()
    expect(review.counts().reviewed).toBe(0)
  })

  it('undoes decisions in reverse order', () => {
    const review = fresh()
    const [email, ip] = review.findings
    review.decide(email!.key, 'keep')
    review.decide(email!.key, 'remove')
    review.decide(ip!.key, 'remove')
    review.undo()
    expect(review.decisionFor(ip!.key)).toBeUndefined()
    review.undo()
    expect(review.decisionFor(email!.key)).toBe('keep')
    review.undo()
    expect(review.decisionFor(email!.key)).toBeUndefined()
    expect(review.undo()).toBe(false)
  })

  it('marks missed text and every other copy of it, removed', () => {
    const review = fresh()
    const start = rows[1]![1]!.indexOf('Anna Huber')
    const added = review.markMissed(at(1, 1), start, start + 'Anna Huber'.length, 'NAME')
    expect(added.map(finding => cellOf(finding).row)).toEqual([1, 2])
    expect(review.counts()).toEqual({ total: 6, reviewed: 2, left: 4 })
    expect(review.cleanedItem(at(2, 1))).toBe('Nothing here, but [NAME_1] wrote it.')
  })

  it('undoes marked text completely', () => {
    const review = fresh()
    const start = rows[2]![1]!.indexOf('Anna Huber')
    review.markMissed(at(2, 1), start, start + 10, 'NAME')
    review.undo()
    expect(review.findings).toHaveLength(4)
    expect(review.cleanedItem(at(2, 1))).toBe(rows[2]![1])
  })

  it('refuses marks that overlap a finding or have surrounding spaces', () => {
    const review = fresh()
    expect(() => review.markMissed(at(0, 1), 3, 12, 'NAME')).toThrow(OverlapError)
    expect(() => review.markMissed(at(2, 1), 7, 13, 'NAME')).toThrow(RangeError)
  })

  it('does not count a marked copy inside a word', () => {
    const review = new Review(itemsFor([['Anna and Annabel']], [0]), [])
    review.markMissed(at(0, 0), 0, 4, 'NAME')
    expect(review.findings).toHaveLength(1)
  })
})

describe('Review: possible forms of marked text', () => {
  const mark = (rows: string[][], value: string, where = { row: 0 }) => {
    const review = new Review(itemsFor(rows, [0]), [])
    const start = rows[where.row]![0]!.indexOf(value)
    review.markMissed(at(where.row, 0), start, start + value.length, 'NAME')
    return review
  }
  const forms = (review: Review) => review.findings.filter(finding => finding.source === 'form')

  it.each([
    ['German genitive', 'Annas Rechnung ist falsch.'],
    ['English possessive', "Anna's invoice is wrong."],
    ['typographic apostrophe', 'Anna’s invoice is wrong.'],
    ['plural possessive', "The Annas' accounts were merged."],
  ])('flags the %s for review', (_, sentence) => {
    const review = mark([['Anna rief an.'], [sentence]], 'Anna')
    expect(forms(review)).toHaveLength(1)
    const [form] = forms(review)
    expect(form).toMatchObject({ item: at(1, 0), value: 'Anna', formOf: 'Anna' })
    expect(review.decisionFor(form!.key)).toBeUndefined()
  })

  it('flags forms of names ending in s, x or z with a bare apostrophe', () => {
    const review = mark([['Hans hat geschrieben.'], ["Hans' Auto steht noch da."], ['Max’ Antwort fehlt.']], 'Hans')
    expect(forms(review).map(form => cellOf(form).row)).toEqual([1])
    expect(forms(mark([['Max fragt.'], ['Max’ Antwort fehlt.']], 'Max')).map(form => cellOf(form).row)).toEqual([1])
  })

  it('flags a form of a marked full name', () => {
    const review = mark([['Anna Huber rief an.'], ['Anna Hubers Vertrag läuft aus.']], 'Anna Huber')
    expect(forms(review).map(form => form.value)).toEqual(['Anna Huber'])
  })

  it('leaves forms pending while exact copies are removed', () => {
    const review = mark([['Anna rief an.'], ['Anna und Annas Team.']], 'Anna')
    const copies = review.findings.filter(finding => finding.source === 'marked')
    expect(copies).toHaveLength(2)
    expect(copies.every(copy => review.decisionFor(copy.key) === 'remove')).toBe(true)
    expect(review.counts()).toEqual({ total: 3, reviewed: 2, left: 1 })
  })

  it('gives a form the placeholder of the marked text and keeps its ending', () => {
    const review = mark([['Anna rief an.'], ['Annas Rechnung.'], ["Anna's invoice."]], 'Anna')
    expect(review.cleanedItem(at(1, 0))).toBe('[NAME_1]s Rechnung.')
    expect(review.cleanedItem(at(2, 0))).toBe("[NAME_1]'s invoice.")
  })

  it('reviews a form on its own: keeping it leaves the marked text removed', () => {
    const review = mark([['Anna rief an.'], ['Annas Rechnung.']], 'Anna')
    review.decide(forms(review)[0]!.key, 'keep')
    expect(review.cleanedItem(at(1, 0))).toBe('Annas Rechnung.')
    expect(review.cleanedItem(at(0, 0))).toBe('[NAME_1] rief an.')
  })

  it('does not flag longer words or compounds', () => {
    const review = mark([['Anna rief an.'], ['Annabel und die Annastraße, Annalena.']], 'Anna')
    expect(forms(review)).toEqual([])
    expect(review.findings).toHaveLength(1)
  })

  it('removes the forms again when the mark is undone', () => {
    const review = mark([['Anna rief an.'], ['Annas Rechnung.']], 'Anna')
    review.undo()
    expect(review.findings).toEqual([])
  })
})

describe('Review: names that arrive during review', () => {
  // As the name model reports them: "Anna" inside the email address, and Anna Huber in rows 2 and 3.
  const names = [
    { id: at(0, 1), detections: [{ type: 'NAME' as const, start: 5, end: 9, value: 'anna' }] },
    { id: at(1, 1), detections: [{ type: 'NAME' as const, start: 31, end: 41, value: 'Anna Huber' }] },
    { id: at(2, 1), detections: [{ type: 'NAME' as const, start: 18, end: 28, value: 'Anna Huber' }] },
  ]

  it('adds them in reading order, leaving out what overlaps an existing finding', () => {
    const review = fresh()
    const added = review.addDetected(names)
    expect(added.map(finding => cellOf(finding).row)).toEqual([1, 2])
    expect(review.findings.map(finding => [cellOf(finding).row, finding.type])).toEqual([[0, 'EMAIL'], [0, 'IP'], [1, 'EMAIL'], [1, 'NAME'], [2, 'NAME'], [3, 'URL']])
    expect(review.cleanedItem(at(2, 1))).toBe('Nothing here, but [NAME_1] wrote it.')
  })

  it('keeps decisions and undo history as they were, and applies a decision to the new copies', () => {
    const review = fresh()
    review.decide(review.findings[0]!.key, 'keep')
    review.addDetected(names.slice(1, 2))
    const name = review.findings.find(finding => finding.type === 'NAME')!
    review.decide(name.key, 'keep')
    review.addDetected(names.slice(2))
    expect(review.copiesOf(name.key).map(copy => review.decisionFor(copy.key))).toEqual(['keep', 'keep'])
    expect(review.undo()).toBe(true)
    expect(review.undo()).toBe(true)
    expect(review.undo()).toBe(false)
    expect(review.findings.filter(finding => finding.type === 'NAME')).toHaveLength(2)
  })

  it('keeps only the part of a name that marked text does not already cover', () => {
    const review = fresh()
    review.markMissed(at(2, 1), 18, 22, 'NAME')
    expect(review.addDetected(names.slice(2)).map(finding => finding.value)).toEqual(['Huber'])
  })
})

describe('Review: a long text with many findings', () => {
  it('marks a value with thousands of copies in one text quickly', () => {
    // One invented message with 2,000 email addresses and 2,000 copies of a missed name.
    const text = Array.from({ length: 2000 }, (_, index) => `kunde${index}@example.com schreibt Zelinka.`).join(' ')
    const review = reviewFor([[text]], [0])
    expect(review.findings).toHaveLength(2000)
    const start = text.indexOf('Zelinka')
    const started = performance.now()
    const added = review.markMissed(at(0, 0), start, start + 'Zelinka'.length, 'NAME')
    expect(added).toHaveLength(2000)
    expect(performance.now() - started).toBeLessThan(1000)
    expect(review.cleanedItem(at(0, 0))).not.toContain('Zelinka')
    // Marking over an existing finding is still refused.
    expect(() => review.markMissed(at(0, 0), 0, 5, 'NAME')).toThrow(OverlapError)
  })
})
