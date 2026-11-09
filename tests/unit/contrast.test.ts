import { describe, expect, it } from 'vitest'
import { contrastRatio } from './contrast'

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    // #767676 on white is the classic "just passes AA" grey.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2)
  })

  it('does not depend on argument order', () => {
    expect(contrastRatio('#1B2433', '#EEF1F4')).toBe(contrastRatio('#EEF1F4', '#1B2433'))
  })

  it('rejects anything other than #rrggbb', () => {
    expect(() => contrastRatio('#fff', '#000000')).toThrow()
  })
})
