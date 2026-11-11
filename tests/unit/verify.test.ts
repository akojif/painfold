import { describe, expect, it } from 'vitest'
import { counts, plan } from '../../scripts/verify'

describe('verify', () => {
  it('runs every step by default, in a fixed order', () => {
    expect(plan([]).map(step => step.name)).toEqual(['lint', 'typecheck', 'unit', 'build', 'model', 'e2e', 'names'])
  })

  it('runs only the steps asked for, and end-to-end tests always against a fresh build', () => {
    expect(plan(['unit', 'lint']).map(step => step.name)).toEqual(['lint', 'unit'])
    expect(plan(['e2e']).map(step => step.name)).toEqual(['build', 'e2e'])
    expect(plan(['names']).map(step => step.name)).toEqual(['build', 'names'])
    expect(() => plan(['tests'])).toThrow('Unknown step: tests')
  })

  it('reads the test counts from Vitest and Playwright, including skipped, failed and flaky tests', () => {
    expect(counts(' Test Files  19 passed (19)\n      Tests  597 passed (597)\n')).toBe('597 passed')
    expect(counts('      Tests  2 failed | 595 passed (597)\n')).toBe('2 failed | 595 passed')
    expect(counts('  4 failed\n    [chromium] › a.spec.ts\n  1 flaky\n  1 skipped\n  180 passed (5.6m)\n')).toBe('4 failed, 1 flaky, 1 skipped, 180 passed')
    expect(counts('\u001B[32m  12 passed\u001B[39m (7.5s)')).toBe('12 passed')
  })
})
