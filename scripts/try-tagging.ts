// Runs the real analysis on the bundled sample file (#126), from Node, with the
// same code the app uses: the payload, the batches, the requests and the
// checks. Prints the tokens the provider reports next to the estimate, and how
// many quotes were dropped or texts not analysed.
//
//   ANTHROPIC_API_KEY=... npm run try:tagging [-- --model claude-sonnet-5-5]
//   npm run try:tagging -- --provider ollama --model llama3.2:3b
//
// With Anthropic it costs real money: about one US cent for the sample with
// Claude Haiku 5.5. With Ollama it runs on this computer, at no cost.
// The key is only read from the environment and never printed or stored. The
// sample is invented, but this still sends its cleaned texts to Anthropic.
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { estimate, PRICES } from '../core/ai/cost.ts'
import { buildPayload } from '../core/ai/payload.ts'
import { runTagging } from '../core/ai/run.ts'
import { anthropicTaggingRequest, ollamaTaggingRequest } from '../core/ai/tagging.ts'
import { classifyFailure } from '../core/ai/providers.ts'
import { guessFeedbackColumn, suggestRoles } from '../core/columns/roles.ts'
import { detectItems } from '../core/detect/items.ts'
import { readCsv } from '../core/import/csv.ts'
import { itemsFromTable, textItems } from '../core/items/table.ts'
import { Review } from '../core/review/review.ts'

const { values } = parseArgs({ options: { provider: { type: 'string', default: 'anthropic' }, model: { type: 'string' } } })
const provider = values.provider === 'ollama' ? 'ollama' : 'anthropic'
const model = values.model ?? (provider === 'ollama' ? 'llama3.2:3b' : 'claude-haiku-5-5')
const key = process.env.ANTHROPIC_API_KEY?.trim() ?? ''
if (provider === 'anthropic' && !key) {
  console.error('Set ANTHROPIC_API_KEY to run this; it costs about one cent for the sample.')
  process.exit(2)
}

const table = readCsv('support-tickets.csv', new Uint8Array(readFileSync('data/sample/support-tickets.csv')))
const roles = suggestRoles(table).map(suggestion => suggestion.role)
const feedbackColumn = guessFeedbackColumn(table)
roles[feedbackColumn!] = 'scan'
const { items } = itemsFromTable(table, roles, { feedbackColumn })
const review = new Review(items, detectItems(textItems(items)))
const { payload } = buildPayload(items.filter(item => item.display !== 'short').map(item => ({ item: item.id, text: review.cleanedItem(item.id) })), provider, model)
const predicted = estimate(payload)

console.log(`Sending ${payload.texts.length} cleaned sample texts to ${model} in batches of 25…`)
const started = Date.now()
const result = await runTagging({
  payload,
  signal: new AbortController().signal,
  onProgress: (done, total) => process.stdout.write(`\r  ${done} of ${total}`),
  send: async (batch) => {
    const request = provider === 'anthropic' ? anthropicTaggingRequest(key, payload, batch) : ollamaTaggingRequest(payload, batch)
    try {
      const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body })
      const body = await response.text()
      if (response.ok) return { ok: true, body }
      const retryAfter = Number(response.headers.get('retry-after'))
      return { ok: false, problem: classifyFailure(response.status, body), ...(retryAfter > 0 ? { retryAfter } : {}) }
    }
    catch {
      return { ok: false, problem: 'unreachable' }
    }
  },
})
console.log(`\n\nDone in ${Math.round((Date.now() - started) / 1000)} s${result.stopped ? `, stopped: ${result.stopped}` : ''}.`)
console.log(`Texts analysed: ${result.tagged.size}, not analysed: ${result.failed.size}`)
console.log(`Quotes dropped (not word for word): ${result.droppedQuotes}, tags dropped (placeholder in label): ${result.droppedLabels}`)
const tags = [...result.tagged.values()].reduce((sum, text) => sum + text.jobs.length + text.pains.length + text.gains.length, 0)
console.log(`Jobs, pains and gains found: ${tags}`)
const price = PRICES[model]
const cost = price ? (result.usage.input * price.input + result.usage.output * price.output) / 1_000_000 : undefined
console.log(`Tokens reported: ${result.usage.input} in, ${result.usage.output} out${cost === undefined ? '' : `, about $${cost.toFixed(4)}`}`)
console.log(`Tokens estimated: ${predicted.inputTokens} in, ${predicted.outputTokens} out${predicted.cost ? `, $${predicted.cost.low.toFixed(4)} to $${predicted.cost.high.toFixed(4)}` : ''}`)
