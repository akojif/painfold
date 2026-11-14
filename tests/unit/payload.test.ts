import { describe, expect, it } from 'vitest'
import { estimate, PRICES } from '../../core/ai/cost'
import { BATCH_SIZE, buildPayload, INSTRUCTIONS, PAYLOAD_FORMAT, payloadFileName, payloadJson, requestCount } from '../../core/ai/payload'
import { leakedValues } from '../../core/export/csv'
import { at, reviewFor } from './review-helpers'

// What Stage 3 sends to the AI (#125). All values are invented.
const rows = [
  ['1', 'Bitte an vera.lind@example.com schreiben, Rückruf +43 660 234 2972.', 'email'],
  ['2', '', 'chat'],
  ['3', '12345', 'phone'],
  ['4', 'The export is too slow.', 'email'],
]

/** The cleaned texts of the checked column, as the consent step takes them from the review. */
function cleanedOf(review: ReturnType<typeof reviewFor>, clean: (item: string) => string = item => review.cleanedItem(item)) {
  return review.items.map(item => ({ item: item.id, text: clean(item.id) }))
}

describe('buildPayload', () => {
  it('sends the cleaned texts with something to analyse, under short ids, and keeps the item mapping in the browser', () => {
    const review = reviewFor(rows, [1])
    const { payload, itemOf } = buildPayload(cleanedOf(review), 'anthropic', 'claude-haiku-5-5')
    expect(payload).toEqual({
      format: PAYLOAD_FORMAT,
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      instructions: INSTRUCTIONS,
      texts: [
        { id: 't1', text: 'Bitte an [EMAIL_1] schreiben, Rückruf [PHONE_1].' },
        { id: 't2', text: 'The export is too slow.' },
      ],
    })
    expect(itemOf).toEqual(new Map([['t1', at(0, 1)], ['t2', at(3, 1)]]))
  })

  it('sends nothing from the file but the texts: no item ids, column values kept as they are, or file name', () => {
    const review = reviewFor(rows, [1])
    const json = payloadJson(buildPayload(cleanedOf(review), 'anthropic', 'claude-haiku-5-5').payload)
    expect(json).not.toContain('cell:')
    expect(json).not.toMatch(/"(?:email|chat|phone)"/)
    expect(Object.keys(JSON.parse(json))).toEqual(['format', 'provider', 'model', 'instructions', 'texts'])
  })

  it('names the download after the provider, the model and the date only', () => {
    expect(payloadFileName({ provider: 'anthropic', model: 'claude-haiku-5-5' }, new Date('2026-11-14T10:00:00Z'))).toBe('painfold-payload-anthropic-claude-haiku-5-5-2026-11-14.json')
    expect(payloadFileName({ provider: 'ollama', model: 'llama3.2:3b' }, new Date('2026-11-14T10:00:00Z'))).toBe('painfold-payload-ollama-llama3-2-3b-2026-11-14.json')
  })

  it('splits the texts into requests of 25', () => {
    const many = Array.from({ length: 60 }, (_, index) => ({ item: `i${index}`, text: `Text ${index}` }))
    expect(requestCount(buildPayload(many, 'anthropic', 'claude-haiku-5-5').payload)).toBe(Math.ceil(60 / BATCH_SIZE))
  })
})

describe('nothing unredacted is sent', () => {
  it('no value removed in the review appears in the payload', () => {
    const review = reviewFor(rows, [1])
    expect(review.findings.length).toBeGreaterThan(0)
    const json = payloadJson(buildPayload(cleanedOf(review), 'anthropic', 'claude-haiku-5-5').payload)
    expect(leakedValues(json, review)).toEqual([])
  })

  it('mutation check: with redaction switched off, the same check finds the leak', () => {
    const review = reviewFor(rows, [1])
    // Redaction off: the original texts instead of the cleaned ones.
    const unredacted = payloadJson(buildPayload(cleanedOf(review, item => review.textOf(item)), 'anthropic', 'claude-haiku-5-5').payload)
    expect(leakedValues(unredacted, review)).toEqual(['vera.lind@example.com', '+43 660 234 2972'])
  })

  it('a value the reviewer kept is sent, as decided', () => {
    const review = reviewFor(rows, [1])
    review.decide(review.findings.find(finding => finding.type === 'PHONE')!.key, 'keep')
    const json = payloadJson(buildPayload(cleanedOf(review), 'anthropic', 'claude-haiku-5-5').payload)
    expect(json).toContain('+43 660 234 2972')
    expect(leakedValues(json, review)).toEqual([])
  })
})

describe('estimate', () => {
  it('estimates tokens from characters and gives a cost range for priced models', () => {
    const texts = Array.from({ length: 100 }, (_, index) => ({ item: `i${index}`, text: 'x'.repeat(200) }))
    const { payload } = buildPayload(texts, 'anthropic', 'claude-haiku-5-5')
    const result = estimate(payload)
    expect(result.outputTokens).toBe(8000)
    expect(result.inputTokens).toBeGreaterThan(100 * 200 / 3.5)
    const dollars = (result.inputTokens * PRICES['claude-haiku-5-5']!.input + result.outputTokens * PRICES['claude-haiku-5-5']!.output) / 1_000_000
    expect(result.cost!.low).toBeCloseTo(dollars * 0.7)
    expect(result.cost!.high).toBeCloseTo(dollars * 1.3)
  })

  it('gives no cost for a model without a price, such as one in Ollama', () => {
    const { payload } = buildPayload([{ item: 'i', text: 'Hello there' }], 'ollama', 'llama3.2:3b')
    expect(estimate(payload).cost).toBeUndefined()
  })
})
