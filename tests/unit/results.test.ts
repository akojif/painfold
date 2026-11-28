import { describe, expect, it } from 'vitest'
import { barLength, intensityLevel, quoteParts, reportOf } from '../../core/ai/results'
import type { Kind } from '../../core/ai/merge'
import { LOW_CONFIDENCE_BELOW, type Theme } from '../../core/ai/themes'

// The first report's layout (#128). All names are invented.
function theme(kind: Kind, name: string, count: number, share: number): Theme {
  return {
    kind,
    name,
    labels: [name],
    items: [],
    count,
    share,
    intensity: 2,
    confidence: count < LOW_CONFIDENCE_BELOW ? 'low' : 'enough',
    quotes: [],
    sentiment: { positive: 0, neutral: 0, negative: count, mixed: 0 },
    types: { 'bug': 0, 'feature request': 0, 'question': 0, 'praise': 0, 'complaint': count, 'other': 0 },
  }
}

describe('intensityLevel', () => {
  it('puts the mean into words at 1.5 and 2.5', () => {
    expect(intensityLevel(1)).toBe('mild')
    expect(intensityLevel(1.49)).toBe('mild')
    expect(intensityLevel(1.5)).toBe('moderate')
    expect(intensityLevel(2.49)).toBe('moderate')
    expect(intensityLevel(2.5)).toBe('strong')
    expect(intensityLevel(3)).toBe('strong')
  })
})

describe('reportOf', () => {
  const themes = {
    jobs: [theme('jobs', 'Pay invoices on time', 12, 0.12), theme('jobs', 'Change the address', 2, 0.02)],
    pains: [theme('pains', 'Login fails', 30, 0.3), theme('pains', 'Slow export', LOW_CONFIDENCE_BELOW, 0.05), theme('pains', 'No dark mode', LOW_CONFIDENCE_BELOW - 1, 0.04)],
    gains: [],
  }

  it('keeps the canvas order: jobs, pains, gains', () => {
    expect(reportOf(themes).sections.map(section => section.kind)).toEqual(['jobs', 'pains', 'gains'])
  })

  it('lists themes from fewer than five items apart, keeping the ranking', () => {
    const pains = reportOf(themes).sections[1]!
    expect(pains.main.map(entry => entry.name)).toEqual(['Login fails', 'Slow export'])
    expect(pains.few.map(entry => entry.name)).toEqual(['No dark mode'])
  })

  it('scales every bar to the largest share in the whole report, not per section', () => {
    const { largestShare } = reportOf(themes)
    expect(largestShare).toBe(0.3)
    expect(barLength(0.12, largestShare)).toBeCloseTo(0.4)
    expect(barLength(0.3, largestShare)).toBe(1)
  })

  it('has no bars when nothing was found', () => {
    const { largestShare, sections } = reportOf({ jobs: [], pains: [], gains: [] })
    expect(largestShare).toBe(0)
    expect(barLength(0, largestShare)).toBe(0)
    expect(sections.every(section => section.main.length === 0 && section.few.length === 0)).toBe(true)
  })
})

describe('quoteParts', () => {
  it('cuts placeholders out of a quote, so they show as tokens', () => {
    expect(quoteParts('[NAME_1] said the link to [EMAIL_2] expired')).toEqual([
      { text: '[NAME_1]', placeholder: true },
      { text: ' said the link to ', placeholder: false },
      { text: '[EMAIL_2]', placeholder: true },
      { text: ' expired', placeholder: false },
    ])
  })

  it('leaves a quote without placeholders, and brackets that are not placeholders, as text', () => {
    expect(quoteParts('the export [beta] is slow')).toEqual([{ text: 'the export [beta] is slow', placeholder: false }])
  })

  it('joins back to the quote exactly', () => {
    const quote = 'Call [PHONE_3] or [NAME_12]'
    expect(quoteParts(quote).map(part => part.text).join('')).toBe(quote)
  })
})
