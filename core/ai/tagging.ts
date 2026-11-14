// Tagging (Stage 3, slice 4, #126): sends the payload in batches and checks
// every answer before anything from it is kept. Plain code: the requests are
// built and the answers checked here; the app only passes them through
// sendAiRequest. What is sent is exactly the consent step's payload.
import { BATCH_SIZE, type AnalysisPayload, type PayloadText } from './payload.ts'
import { ANTHROPIC, OLLAMA, type AiRequest } from './providers.ts'

export const SENTIMENTS = ['positive', 'negative', 'mixed', 'neutral'] as const
export const TYPES = ['bug', 'feature request', 'question', 'praise', 'complaint', 'other'] as const

/** A job, pain or gain in one text. The quote is kept only when it appears word for word in the text. */
export type Tag = { label: string, intensity: 1 | 2 | 3, quote?: string }

export type TaggedText = {
  id: string
  jobs: Tag[]
  pains: Tag[]
  gains: Tag[]
  sentiment: typeof SENTIMENTS[number]
  type: typeof TYPES[number]
}

const TAG_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    intensity: { type: 'integer', enum: [1, 2, 3] },
    quote: { type: 'string' },
  },
  required: ['label', 'intensity', 'quote'],
  additionalProperties: false,
}

/** The answer's shape, for the provider's structured output and for the check here. */
export const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    texts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          jobs: { type: 'array', items: TAG_SCHEMA },
          pains: { type: 'array', items: TAG_SCHEMA },
          gains: { type: 'array', items: TAG_SCHEMA },
          sentiment: { type: 'string', enum: [...SENTIMENTS] },
          type: { type: 'string', enum: [...TYPES] },
        },
        required: ['id', 'jobs', 'pains', 'gains', 'sentiment', 'type'],
        additionalProperties: false,
      },
    },
  },
  required: ['texts'],
  additionalProperties: false,
}

// Tagging is classification: low effort is enough and keeps the cost down.
// Tuned on the dev split once it is labelled (#129).
const EFFORT = 'low'
const MAX_TOKENS = 16000

/** The batches of texts, in order, each sent as one request. */
export function batchesOf(texts: readonly PayloadText[], size = BATCH_SIZE): PayloadText[][] {
  const batches: PayloadText[][] = []
  for (let start = 0; start < texts.length; start += size) batches.push(texts.slice(start, start + size))
  return batches
}

/** What one request carries besides the instructions: the batch's texts as JSON, ids and texts only. */
export const batchContent = (batch: readonly PayloadText[]) => JSON.stringify({ texts: batch.map(({ id, text }) => ({ id, text })) })

/** One batch for Anthropic: the instructions as the system prompt, the texts as the message, the answer held to the schema. */
export function anthropicTaggingRequest(key: string, payload: AnalysisPayload, batch: readonly PayloadText[]): AiRequest {
  return {
    url: `${ANTHROPIC.endpoint}/v1/messages`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: payload.model,
      max_tokens: MAX_TOKENS,
      system: payload.instructions,
      messages: [{ role: 'user', content: batchContent(batch) }],
      output_config: { effort: EFFORT, format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
    }),
  }
}

/** One batch for Ollama, with its answer held to the same schema. */
export function ollamaTaggingRequest(payload: AnalysisPayload, batch: readonly PayloadText[]): AiRequest {
  return {
    url: `${OLLAMA.endpoint}/api/chat`,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: payload.model,
      stream: false,
      format: ANSWER_SCHEMA,
      messages: [{ role: 'system', content: payload.instructions }, { role: 'user', content: batchContent(batch) }],
    }),
  }
}

/** Why an answer could not be used: cut off (too long for one answer), refused, or not the agreed shape. */
export type AnswerProblem = 'cutOff' | 'refused' | 'invalid'

/** The answer's JSON text, or why there is none. */
export function answerText(provider: AnalysisPayload['provider'], body: string): string | AnswerProblem {
  let answer: unknown
  try {
    answer = JSON.parse(body)
  }
  catch {
    return 'invalid'
  }
  if (provider === 'anthropic') {
    const message = answer as { stop_reason?: string, content?: Array<{ type?: string, text?: string }> }
    if (message.stop_reason === 'max_tokens') return 'cutOff'
    if (message.stop_reason === 'refusal') return 'refused'
    const text = (message.content ?? []).filter(block => block.type === 'text').map(block => block.text ?? '').join('')
    return text || 'invalid'
  }
  const chat = answer as { done_reason?: string, message?: { content?: string } }
  if (chat.done_reason === 'length') return 'cutOff'
  return chat.message?.content || 'invalid'
}

/** The tokens the provider reports for one answer, to compare with the estimate. */
export function usageOf(provider: AnalysisPayload['provider'], body: string): { input: number, output: number } | undefined {
  try {
    const answer = JSON.parse(body)
    if (provider === 'anthropic') return { input: answer.usage?.input_tokens ?? 0, output: answer.usage?.output_tokens ?? 0 }
    return { input: answer.prompt_eval_count ?? 0, output: answer.eval_count ?? 0 }
  }
  catch {
    return undefined
  }
}

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim()
const PLACEHOLDER = /\[[A-Z_]+_\d+\]/

/** Whether a quote appears word for word in the text; only differences in spaces and line breaks are ignored. */
export const quoteFits = (quote: string, text: string) => tidy(quote).length > 0 && tidy(text).includes(tidy(quote))

export type CheckedBatch = {
  tagged: TaggedText[]
  /** Texts of the batch the answer left out. */
  missing: string[]
  /** Quotes that did not appear in their text: the tag is kept, the quote never shown. */
  droppedQuotes: number
  /** Tags whose label held a placeholder such as [NAME_1]: left out. */
  droppedLabels: number
}

function isTag(value: unknown): value is { label: string, intensity: number, quote: string } {
  const tag = value as { label?: unknown, intensity?: unknown, quote?: unknown }
  return typeof tag?.label === 'string' && [1, 2, 3].includes(tag.intensity as number) && typeof tag.quote === 'string'
}

/**
 * Checks an answer against the batch it answers. Returns undefined if it is
 * not the agreed shape at all. Unknown ids are ignored, a repeated id counts
 * once, and texts left out are listed in `missing`.
 */
export function checkAnswer(batch: readonly PayloadText[], json: string): CheckedBatch | undefined {
  let answer: unknown
  try {
    answer = JSON.parse(json)
  }
  catch {
    return undefined
  }
  const entries = (answer as { texts?: unknown })?.texts
  if (!Array.isArray(entries)) return undefined

  const texts = new Map(batch.map(entry => [entry.id, entry.text]))
  const tagged = new Map<string, TaggedText>()
  let droppedQuotes = 0
  let droppedLabels = 0
  for (const entry of entries as Array<Record<string, unknown>>) {
    const id = entry?.id
    if (typeof id !== 'string' || !texts.has(id) || tagged.has(id)) continue
    const lists = [entry.jobs, entry.pains, entry.gains]
    if (!lists.every(list => Array.isArray(list) && list.every(isTag))) continue
    if (!(SENTIMENTS as readonly unknown[]).includes(entry.sentiment) || !(TYPES as readonly unknown[]).includes(entry.type)) continue
    const text = texts.get(id)!
    const tags = (list: unknown) => (list as Array<{ label: string, intensity: number, quote: string }>).flatMap((tag): Tag[] => {
      const label = tidy(tag.label)
      if (!label || PLACEHOLDER.test(label)) {
        droppedLabels++
        return []
      }
      const fits = quoteFits(tag.quote, text)
      if (!fits) droppedQuotes++
      return [{ label, intensity: tag.intensity as Tag['intensity'], ...(fits ? { quote: tidy(tag.quote) } : {}) }]
    })
    tagged.set(id, { id, jobs: tags(entry.jobs), pains: tags(entry.pains), gains: tags(entry.gains), sentiment: entry.sentiment as TaggedText['sentiment'], type: entry.type as TaggedText['type'] })
  }
  return { tagged: [...tagged.values()], missing: batch.map(entry => entry.id).filter(id => !tagged.has(id)), droppedQuotes, droppedLabels }
}
