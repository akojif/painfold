// A cost estimate before anything is sent (#125), computed here, never with a
// provider's token counter (that would already send the text). Tokens are
// estimated from characters: about 3.5 characters per token for German and
// English text, with a ±30% range. Slice 4 checks the estimate against the
// tokens the provider reports for the sample file.
import { BATCH_SIZE, type AnalysisPayload } from './payload.ts'

/** US dollars per million tokens, from the provider's price list on the date checked. */
export const PRICES: Record<string, { input: number, output: number }> = {
  'claude-haiku-5-5': { input: 0.10, output: 0.50 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
}
export const PRICES_CHECKED = '2026-11-13'

const CHARACTERS_PER_TOKEN = 3.5
// The answer per text: labels, quotes and intensities for a few jobs, pains and gains.
const OUTPUT_TOKENS_PER_TEXT = 80
const RANGE = 0.3

export type Estimate = { inputTokens: number, outputTokens: number, cost?: { low: number, high: number } }

/** Tokens in and out for the whole payload, and the cost range where the model has a price (Ollama has none). */
export function estimate(payload: AnalysisPayload): Estimate {
  const batches = Math.ceil(payload.texts.length / BATCH_SIZE)
  const characters = payload.texts.reduce((sum, { id, text }) => sum + id.length + text.length, 0) + batches * payload.instructions.length
  const inputTokens = Math.round(characters / CHARACTERS_PER_TOKEN)
  const outputTokens = payload.texts.length * OUTPUT_TOKENS_PER_TEXT
  const price = PRICES[payload.model]
  if (!price) return { inputTokens, outputTokens }
  const dollars = (inputTokens * price.input + outputTokens * price.output) / 1_000_000
  return { inputTokens, outputTokens, cost: { low: dollars * (1 - RANGE), high: dollars * (1 + RANGE) } }
}
