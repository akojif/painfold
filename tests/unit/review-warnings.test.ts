import { describe, expect, it } from 'vitest'
import { detectTable } from '../../core/detect/table'
import { Review } from '../../core/review/review'

// All examples are invented.
const rows = [
  ['1', 'Ich bin 42 Jahre alt, Mail: vera.lind@example.com'],
  ['2', 'Ich bin Steuerberaterin in Wels und brauche einen Export.'],
  ['3', 'As the only female CFO here, I need audit logs.'],
  ['4', 'Der Export dauert zu lange.'],
]
const columns = [1]
const fresh = () => new Review(rows, columns, detectTable(rows, columns))

/** The name model's finding for "Wels" in row 2, as it arrives in the background. */
const wels = () => {
  const start = rows[1]![1]!.indexOf('Wels')
  return [{ row: 1, column: 1, detections: [{ type: 'PLACE' as const, start, end: start + 4, value: 'Wels' }] }]
}

describe('Review warnings', () => {
  it('finds warnings in the checked columns, next to the findings, and keeps them by default', () => {
    const review = fresh()
    expect(review.warnings.map(warning => [warning.row, warning.reason, warning.value])).toEqual([
      [0, 'age', '42 Jahre alt'],
      [2, 'only', 'only female CFO'],
    ])
    expect(review.warningCounts()).toEqual({ total: 2, removed: 0, dismissed: 0, open: 2 })
    expect(review.cleanedCell(0, 1)).toBe('Ich bin 42 Jahre alt, Mail: [EMAIL_1]')
  })

  it('replaces a removed warning with a placeholder, next to removed findings', () => {
    const review = fresh()
    review.decideWarning(review.warnings[0]!.key, 'remove')
    expect(review.cleanedCell(0, 1)).toBe('Ich bin [AGE_1], Mail: [EMAIL_1]')
    expect(review.warningCounts()).toMatchObject({ removed: 1, open: 1 })
  })

  it('keeps a dismissed warning', () => {
    const review = fresh()
    review.decideWarning(review.warnings[1]!.key, 'dismiss')
    expect(review.cleanedCell(2, 1)).toBe(rows[2]![1])
    expect(review.warningCounts()).toMatchObject({ dismissed: 1, open: 1 })
  })

  it('undoes warning decisions, one at a time and all at once', () => {
    const review = fresh()
    review.decideWarning(review.warnings[0]!.key, 'remove')
    expect(review.undo()).toBe(true)
    expect(review.warningDecisionFor(review.warnings[0]!.key)).toBeUndefined()

    expect(review.decideAllWarnings('remove')).toBe(2)
    expect(review.cleanedCell(2, 1)).toBe('As the [ROLE_1] here, I need audit logs.')
    review.undo()
    expect(review.warningCounts().open).toBe(2)
  })

  it('links a job title to a place when the name model finds it, and says when the place is removed', () => {
    const review = fresh()
    expect(review.warnings.some(warning => warning.row === 1)).toBe(false)

    review.addDetected(wels())
    const role = review.warnings.find(warning => warning.row === 1)!
    expect(role).toMatchObject({ reason: 'role-place', value: 'Steuerberaterin', place: { value: 'Wels' } })
    // The place is a finding nobody decided on, so it is removed.
    expect(review.placeRemoved(role)).toBe(true)

    const place = review.findings.find(finding => finding.type === 'PLACE')!
    review.decide(place.key, 'keep')
    expect(review.placeRemoved(role)).toBe(false)
  })

  it('keeps a decision when a warning is found again after new findings arrive', () => {
    const review = fresh()
    const age = review.warnings[0]!
    review.decideWarning(age.key, 'dismiss')
    review.addDetected([{ row: 0, column: 1, detections: [] }])
    expect(review.warningDecisionFor(review.warnings[0]!.key)).toBe('dismiss')
  })

  it('drops a warning that a marked finding covers, and brings it back when the mark is undone', () => {
    const review = fresh()
    const text = rows[2]![1]!
    const start = text.indexOf('only female CFO')
    review.markMissed(2, 1, start, start + 'only female CFO'.length, 'NAME')
    expect(review.warnings.some(warning => warning.row === 2)).toBe(false)
    review.undo()
    expect(review.warnings.some(warning => warning.row === 2)).toBe(true)
  })

  it('finds no warnings in columns that are not checked', () => {
    const review = new Review(rows, [0], [])
    expect(review.warnings).toEqual([])
  })

  it('checks a 5,000-row file quickly', () => {
    const big = Array.from({ length: 5000 }, (_, index) => [String(index), rows[index % rows.length]![1]!])
    const started = performance.now()
    const review = new Review(big, columns, [])
    expect(review.warnings.length).toBe(2500)
    expect(performance.now() - started).toBeLessThan(1500)
  })
})
