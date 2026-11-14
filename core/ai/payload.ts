// What Stage 3 sends to the AI, built once and used twice: the consent step
// shows it (and offers it as a download), and the analysis sends exactly it
// (#125, #126). Nothing else from the file is sent: no file name, no column
// names, no unit attributes, no item ids. Each text goes out under a short id
// (t1, t2, ...); the mapping back to the items stays in the browser.
import type { ProviderId } from './providers.ts'

export const PAYLOAD_FORMAT = 'painfold-analysis/1'

/**
 * The instructions sent with every batch of texts. Version 1, written before
 * any tuning; slice 4 (#126) tunes them on the dev split of the evaluation set
 * only (#129). Shown in full in the consent step.
 */
export const INSTRUCTIONS = `You analyse customer feedback for a product team, using the Value Proposition Canvas.

For each text, find:
- jobs: what the customer is trying to get done, in their words (a goal, not a feature).
- pains: what frustrates, blocks or risks that job.
- gains: what the customer wants or would be delighted by.
Each with a short label from the customer's point of view (2 to 7 words, in the language of the text), an intensity from 1 (mild) to 3 (strong), and a quote: the exact words from the text that show it, copied character for character.

Also give each text's overall sentiment (positive, negative, mixed or neutral) and its main type (bug, feature request, question, praise, complaint or other).

Rules:
- Only what the text says. A text can have no jobs, pains or gains.
- Placeholders such as [NAME_1] or [EMAIL_2] replace removed personal data. Never guess what they stand for, and never put them in a label.
- Answer only with JSON: {"texts": [{"id": "...", "jobs": [...], "pains": [...], "gains": [...], "sentiment": "...", "type": "..."}]}, one entry per text, with each job, pain and gain as {"label": "...", "intensity": 1, "quote": "..."}.`

export type PayloadText = { id: string, text: string }

/** The whole payload: what the download contains, and what the analysis sends, in batches. */
export type AnalysisPayload = {
  format: typeof PAYLOAD_FORMAT
  provider: ProviderId
  model: string
  instructions: string
  texts: PayloadText[]
}

/**
 * Builds the payload from cleaned texts (the review's cleanedItem), leaving out
 * texts with nothing to analyse (empty or without a letter). Returns which item
 * each short id stands for, which stays in the browser.
 */
export function buildPayload(cleaned: ReadonlyArray<{ item: string, text: string }>, provider: ProviderId, model: string): { payload: AnalysisPayload, itemOf: Map<string, string> } {
  const itemOf = new Map<string, string>()
  const texts: PayloadText[] = []
  for (const { item, text } of cleaned) {
    if (!/\p{L}/u.test(text)) continue
    const id = `t${texts.length + 1}`
    itemOf.set(id, item)
    texts.push({ id, text })
  }
  return { payload: { format: PAYLOAD_FORMAT, provider, model, instructions: INSTRUCTIONS, texts }, itemOf }
}

/** The download's file name: the provider, the model and the date, nothing from the file. */
export function payloadFileName(payload: Pick<AnalysisPayload, 'provider' | 'model'>, date: Date): string {
  const day = date.toISOString().slice(0, 10)
  const model = payload.model.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/\./g, '-')
  return `painfold-payload-${payload.provider}-${model}-${day}.json`
}

/** The payload as the download holds it: the same JSON the analysis sends. */
export const payloadJson = (payload: AnalysisPayload) => `${JSON.stringify(payload, null, 2)}\n`

// Texts per request: small enough for a fast, checkable answer, large enough
// that the instructions are a small share of what is sent.
export const BATCH_SIZE = 25

/** How many requests the analysis makes for this payload. */
export const requestCount = (payload: AnalysisPayload) => Math.ceil(payload.texts.length / BATCH_SIZE)
