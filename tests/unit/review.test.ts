import { describe, expect, it } from 'vitest'
import { detectTable } from '../../core/detect/table'
import { OverlapError, Review } from '../../core/review/review'

const rows = [
  ['1', 'Mail anna@example.com, IP 192.0.2.7'],
  ['2', 'Again ANNA@example.com please. Anna Huber called.'],
  ['3', 'Nothing here, but Anna Huber wrote it.'],
  ['4', 'See https://example.com/i/1'],
]
const columns = [1]
const fresh = () => new Review(rows, columns, detectTable(rows, columns))

describe('Review', () => {
  it('lists findings in reading order with placeholders fixed by first appearance', () => {
    const review = fresh()
    expect(review.findings.map(finding => [finding.row, finding.type])).toEqual([[0, 'EMAIL'], [0, 'IP'], [1, 'EMAIL'], [3, 'URL']])
    expect(review.findings.map(finding => review.placeholderFor(finding))).toEqual(['[EMAIL_1]', '[IP_1]', '[EMAIL_1]', '[LINK_1]'])
  })

  it('applies a decision to every copy of a value', () => {
    const review = fresh()
    const email = review.findings[0]!
    expect(review.copiesOf(email.key)).toHaveLength(2)
    review.decide(email.key, 'keep')
    expect(review.counts()).toEqual({ total: 4, reviewed: 2, left: 2 })
    expect(review.cleanedCell(1, 1)).toBe('Again ANNA@example.com please. Anna Huber called.')
  })

  it('removes undecided findings when cleaning', () => {
    const review = fresh()
    expect(review.cleanedCell(0, 1)).toBe('Mail [EMAIL_1], IP [IP_1]')
    expect(review.cleanedCell(0, 0)).toBe('1')
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
    const added = review.markMissed(1, 1, start, start + 'Anna Huber'.length, 'NAME')
    expect(added.map(finding => finding.row)).toEqual([1, 2])
    expect(review.counts()).toEqual({ total: 6, reviewed: 2, left: 4 })
    expect(review.cleanedCell(2, 1)).toBe('Nothing here, but [NAME_1] wrote it.')
  })

  it('undoes marked text completely', () => {
    const review = fresh()
    const start = rows[2]![1]!.indexOf('Anna Huber')
    review.markMissed(2, 1, start, start + 10, 'NAME')
    review.undo()
    expect(review.findings).toHaveLength(4)
    expect(review.cleanedCell(2, 1)).toBe(rows[2]![1])
  })

  it('refuses marks that overlap a finding or have surrounding spaces', () => {
    const review = fresh()
    expect(() => review.markMissed(0, 1, 3, 12, 'NAME')).toThrow(OverlapError)
    expect(() => review.markMissed(2, 1, 7, 13, 'NAME')).toThrow(RangeError)
  })

  it('does not count a marked copy inside a word', () => {
    const review = new Review([['Anna and Annabel']], [0], [])
    review.markMissed(0, 0, 0, 4, 'NAME')
    expect(review.findings).toHaveLength(1)
  })
})
