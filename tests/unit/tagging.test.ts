import { describe, expect, it } from 'vitest'
import { buildPayload, BATCH_SIZE, type PayloadText } from '../../core/ai/payload'
import { BACKOFF, runTagging, type BatchReply } from '../../core/ai/run'
import { AI_ENDPOINTS } from '../../deploy/headers'
import { ANSWER_SCHEMA, anthropicTaggingRequest, answerText, batchContent, batchesOf, checkAnswer, ollamaTaggingRequest, quoteFits, usageOf } from '../../core/ai/tagging'

// Tagging (#126). All texts are invented.
const texts = (n: number) => Array.from({ length: n }, (_, index) => ({ item: `i${index}`, text: `The export of report ${index} takes forever.` }))
const payloadOf = (n: number) => buildPayload(texts(n), 'anthropic', 'claude-haiku-5-5').payload

/** A good answer for a batch: one pain per text, quoting it exactly. */
function answerFor(batch: readonly PayloadText[], change: (entry: Record<string, unknown>) => Record<string, unknown> = entry => entry) {
  const json = JSON.stringify({ texts: batch.map(({ id, text }) => change({ id, jobs: [], pains: [{ label: 'Slow exports', intensity: 2, quote: text.slice(4, 30) }], gains: [], sentiment: 'negative', type: 'complaint' })) })
  return JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: json }], usage: { input_tokens: 100, output_tokens: 50 } })
}

describe('requests', () => {
  it('sends Anthropic the instructions as the system prompt and only the batch\'s ids and texts, held to the schema', () => {
    const payload = payloadOf(30)
    const [first] = batchesOf(payload.texts)
    expect(first).toHaveLength(BATCH_SIZE)
    const request = anthropicTaggingRequest('sk-ant-invented', payload, first!)
    expect(AI_ENDPOINTS).toContain(new URL(request.url).origin)
    expect(request.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    const body = JSON.parse(request.body!)
    expect(body).toMatchObject({ model: 'claude-haiku-5-5', system: payload.instructions, output_config: { effort: 'low', format: { type: 'json_schema', schema: ANSWER_SCHEMA } } })
    expect(body.messages).toEqual([{ role: 'user', content: batchContent(first!) }])
    expect(JSON.parse(body.messages[0].content)).toEqual({ texts: payload.texts.slice(0, BATCH_SIZE) })
  })

  it('sends Ollama the same, with its schema format', () => {
    const payload = buildPayload(texts(3), 'ollama', 'llama3.2:3b').payload
    const request = ollamaTaggingRequest(payload, payload.texts)
    expect(new URL(request.url).origin).toBe('http://localhost:11434')
    const body = JSON.parse(request.body!)
    expect(body).toMatchObject({ model: 'llama3.2:3b', stream: false, format: ANSWER_SCHEMA })
    expect(body.messages).toEqual([{ role: 'system', content: payload.instructions }, { role: 'user', content: batchContent(payload.texts) }])
  })

  it('every object in the schema forbids extra fields, as structured output requires', () => {
    const objects: Array<Record<string, unknown>> = []
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return
      if ((node as { type?: string }).type === 'object') objects.push(node as Record<string, unknown>)
      for (const value of Object.values(node)) walk(value)
    }
    walk(ANSWER_SCHEMA)
    // The answer, each text, and the tag schema used for jobs, pains and gains.
    expect(objects.length).toBe(5)
    for (const object of objects) expect(object.additionalProperties).toBe(false)
  })
})

describe('reading and checking answers', () => {
  it('reads the JSON text, and names answers that were cut off, refused or broken', () => {
    expect(answerText('anthropic', JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"texts":[]}' }] }))).toBe('{"texts":[]}')
    expect(answerText('anthropic', JSON.stringify({ stop_reason: 'max_tokens', content: [] }))).toBe('cutOff')
    expect(answerText('anthropic', JSON.stringify({ stop_reason: 'refusal', content: [] }))).toBe('refused')
    expect(answerText('anthropic', 'not json')).toBe('invalid')
    expect(answerText('ollama', JSON.stringify({ message: { content: '{"texts":[]}' } }))).toBe('{"texts":[]}')
    expect(answerText('ollama', JSON.stringify({ done_reason: 'length', message: { content: '{"tex' } }))).toBe('cutOff')
    expect(usageOf('anthropic', JSON.stringify({ usage: { input_tokens: 7, output_tokens: 3 } }))).toEqual({ input: 7, output: 3 })
    expect(usageOf('ollama', JSON.stringify({ prompt_eval_count: 7, eval_count: 3 }))).toEqual({ input: 7, output: 3 })
  })

  it('keeps quotes that appear word for word, ignoring only spaces and line breaks', () => {
    expect(quoteFits('takes   forever', 'The export\ntakes forever.')).toBe(true)
    expect(quoteFits('takes ages', 'The export takes forever.')).toBe(false)
    expect(quoteFits('Takes forever', 'The export takes forever.')).toBe(false)
    expect(quoteFits('  ', 'anything')).toBe(false)
  })

  it('keeps a tag whose quote does not match, without the quote, and counts it', () => {
    const batch = [{ id: 't1', text: 'The export takes forever.' }]
    const checked = checkAnswer(batch, JSON.stringify({ texts: [{ id: 't1', jobs: [], pains: [{ label: 'Slow exports', intensity: 3, quote: 'export is slow' }], gains: [], sentiment: 'negative', type: 'complaint' }] }))!
    expect(checked.tagged[0]!.pains).toEqual([{ label: 'Slow exports', intensity: 3 }])
    expect(checked.droppedQuotes).toBe(1)
  })

  it('leaves out tags whose label holds a placeholder, ignores unknown and repeated ids, and lists texts left out', () => {
    const batch = [{ id: 't1', text: 'Call [NAME_1] about the export.' }, { id: 't2', text: 'Fine.' }]
    const entry = (id: string, label: string) => ({ id, jobs: [{ label, intensity: 1, quote: 'the export' }], pains: [], gains: [], sentiment: 'neutral', type: 'other' })
    const checked = checkAnswer(batch, JSON.stringify({ texts: [entry('t1', 'Talk to [NAME_1]'), entry('t1', 'Second copy'), entry('t9', 'Unknown')] }))!
    expect(checked.tagged).toEqual([{ id: 't1', jobs: [], pains: [], gains: [], sentiment: 'neutral', type: 'other' }])
    expect(checked.droppedLabels).toBe(1)
    expect(checked.missing).toEqual(['t2'])
  })

  it('rejects answers that are not the agreed shape', () => {
    const batch = [{ id: 't1', text: 'x' }]
    expect(checkAnswer(batch, 'nope')).toBeUndefined()
    expect(checkAnswer(batch, '{"items":[]}')).toBeUndefined()
    const wrong = checkAnswer(batch, JSON.stringify({ texts: [{ id: 't1', jobs: [], pains: [], gains: [], sentiment: 'angry', type: 'bug' }] }))!
    expect(wrong.tagged).toEqual([])
    expect(wrong.missing).toEqual(['t1'])
  })
})

describe('runTagging', () => {
  const never = () => new AbortController().signal
  const noWait = async () => {}

  it('tags every text, two batches at a time, adding up the tokens', async () => {
    const payload = payloadOf(60)
    let active = 0
    let most = 0
    const sent: string[][] = []
    const result = await runTagging({
      payload,
      signal: never(),
      wait: noWait,
      send: async (batch) => {
        active++
        most = Math.max(most, active)
        sent.push(batch.map(text => text.id))
        await new Promise(resolve => setTimeout(resolve, 5))
        active--
        return { ok: true, body: answerFor(batch) }
      },
    })
    expect(result.tagged.size).toBe(60)
    expect(result.failed.size).toBe(0)
    expect(most).toBe(2)
    expect(sent.flat().sort()).toEqual(payload.texts.map(text => text.id).sort())
    expect(result.usage).toEqual({ input: 300, output: 150 })
  })

  it('retries a broken answer once, then marks its texts not analysed', async () => {
    const payload = payloadOf(3)
    let calls = 0
    const result = await runTagging({ payload, signal: never(), wait: noWait, send: async () => (calls++, { ok: true, body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'oops' }] }) }) })
    expect(calls).toBe(2)
    expect([...result.failed]).toEqual(['t1', 't2', 't3'])
    expect(result.stopped).toBeUndefined()
  })

  it('splits a batch whose answer was cut off, and tags both halves', async () => {
    const payload = payloadOf(10)
    const sizes: number[] = []
    const result = await runTagging({
      payload,
      signal: never(),
      wait: noWait,
      send: async (batch) => {
        sizes.push(batch.length)
        return batch.length > 5 ? { ok: true, body: JSON.stringify({ stop_reason: 'max_tokens', content: [] }) } : { ok: true, body: answerFor(batch) }
      },
    })
    expect(sizes).toEqual([10, 5, 5])
    expect(result.tagged.size).toBe(10)
  })

  it('waits as the provider asks when busy, backs off otherwise, and pauses after the last try', async () => {
    const waits: number[] = []
    const replies: BatchReply[] = [{ ok: false, problem: 'rateLimited', retryAfter: 7 }, { ok: false, problem: 'overloaded' }]
    const payload = payloadOf(1)
    const result = await runTagging({
      payload,
      signal: never(),
      wait: async (seconds) => {
        waits.push(seconds)
      },
      send: async batch => replies.shift() ?? { ok: true, body: answerFor(batch) },
    })
    expect(waits).toEqual([7, BACKOFF[1]])
    expect(result.tagged.size).toBe(1)

    const busy = await runTagging({ payload, signal: never(), wait: noWait, send: async () => ({ ok: false, problem: 'overloaded' }) })
    expect(busy.stopped).toBe('overloaded')
    expect(busy.tagged.size).toBe(0)
  })

  it('pauses at once on a problem no retry fixes, such as an invalid key', async () => {
    let calls = 0
    const result = await runTagging({ payload: payloadOf(60), signal: never(), wait: noWait, send: async () => (calls++, { ok: false, problem: 'invalidKey' }) })
    expect(result.stopped).toBe('invalidKey')
    expect(calls).toBeLessThanOrEqual(2)
  })

  it('stops when cancelled, and a resumed run sends only what is left, never a text twice', async () => {
    const payload = payloadOf(100)
    const controller = new AbortController()
    const sent: string[] = []
    const first = await runTagging({
      payload,
      signal: controller.signal,
      wait: noWait,
      concurrency: 1,
      send: async (batch) => {
        sent.push(...batch.map(text => text.id))
        if (sent.length >= 50) controller.abort()
        return { ok: true, body: answerFor(batch) }
      },
    })
    expect(first.stopped).toBe('cancelled')
    const second = await runTagging({ payload, done: first.tagged, signal: never(), wait: noWait, send: async batch => (sent.push(...batch.map(text => text.id)), { ok: true, body: answerFor(batch) }) })
    expect(second.tagged.size).toBe(100)
    expect(new Set(sent).size).toBe(sent.length)
  })
})
