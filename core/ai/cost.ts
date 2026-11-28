// A cost estimate before anything is sent (#125), computed here, never with a
// provider's token counter (that would already send the text). Tokens are
// estimated from characters: about 3.5 characters per token for German and
// English text, with a ±30% range.
//
// Calibrated on one real run (#126, 2026-11-14): the sample file, 200 texts in
// 8 batches, with Claude Haiku 5.5. Anthropic reported 21,652 tokens in and
// 53,580 out ($0.0290). Two costs the characters alone miss:
// - each request carries the answer schema, which Anthropic adds to the prompt
//   for structured output: about 1,700 tokens per batch on top of the
//   instructions;
// - the answer includes the model's thinking (adaptive, on by default), about
//   270 tokens per text instead of the ~80 the JSON alone needs.
// Claude Sonnet 5.5 is not measured yet; it may think more per text.
//
// Merging (#127) adds one request per kind with the labels found: about 20
// tokens in per text (the labels as sent), and about 2,500 tokens of thinking
// per request plus 8 per text in the answer. Measured on a second run with
// Haiku 5.5 (sample file, 2026-11-14): 9,801 tokens in and 9,181 out for the
// merging, 31,453 in and 62,750 out ($0.0345) in all.
import { BATCH_SIZE, type AnalysisPayload } from './payload.ts'

/** US dollars per million tokens, from the provider's price list on the date checked. */
export const PRICES: Record<string, { input: number, output: number }> = {
  'claude-haiku-5-5': { input: 0.10, output: 0.50 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
}
export const PRICES_CHECKED = '2026-11-13'

const CHARACTERS_PER_TOKEN = 3.5
const RANGE = 0.3

/** Per provider: tokens added to every batch beyond the instructions, and answer tokens per text. */
const OVERHEAD: Record<AnalysisPayload['provider'], { perBatch: number, outputPerText: number }> = {
  // Measured: the structured-output schema, and thinking plus the JSON.
  anthropic: { perBatch: 1700, outputPerText: 270 },
  // Not measured: Ollama constrains the answer without adding a prompt, and small local models do not think. Free either way.
  ollama: { perBatch: 0, outputPerText: 80 },
}

// Merging: one request per kind (jobs, pains, gains).
const MERGE_REQUESTS = 3
const MERGE_INPUT_PER_TEXT = 20
const MERGE_OUTPUT_PER_TEXT = 8
// Thinking before each merge answer.
const MERGE_OUTPUT_PER_REQUEST: Record<AnalysisPayload['provider'], number> = { anthropic: 2500, ollama: 0 }

export type Estimate = { inputTokens: number, outputTokens: number, cost?: { low: number, high: number } }

/** Tokens in and out for the whole payload, and the cost range where the model has a price (Ollama has none). */
export function estimate(payload: AnalysisPayload): Estimate {
  const { perBatch, outputPerText } = OVERHEAD[payload.provider]
  const batches = Math.ceil(payload.texts.length / BATCH_SIZE)
  const characters = payload.texts.reduce((sum, { id, text }) => sum + id.length + text.length, 0) + batches * payload.instructions.length
  const merge = payload.texts.length === 0 ? 0 : MERGE_REQUESTS
  const inputTokens = Math.round(characters / CHARACTERS_PER_TOKEN) + batches * perBatch
    + merge * (Math.round(payload.mergeInstructions.length / CHARACTERS_PER_TOKEN) + perBatch) + payload.texts.length * MERGE_INPUT_PER_TEXT
  const outputTokens = payload.texts.length * (outputPerText + MERGE_OUTPUT_PER_TEXT) + merge * MERGE_OUTPUT_PER_REQUEST[payload.provider]
  const price = PRICES[payload.model]
  if (!price) return { inputTokens, outputTokens }
  const dollars = (inputTokens * price.input + outputTokens * price.output) / 1_000_000
  return { inputTokens, outputTokens, cost: { low: dollars * (1 - RANGE), high: dollars * (1 + RANGE) } }
}
