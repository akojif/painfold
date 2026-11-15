// Makes the demo analysis (#130): a real run on the made-up sample file,
// stored in data/demo/analysis.json and replayed in the app without any
// request (core/ai/demo.ts).
//
//   npm run generate && ANTHROPIC_API_KEY=... npm run demo:generate
//   npm run demo:generate -- --stand-in      invented answers, no key, no cost (for building only)
//
// 1. The payload is made the way a careful person makes it: in the built app,
//    in Chromium, with the name model. The sample is opened, names are checked,
//    every finding is removed, and "exactly what will be sent" is downloaded.
//    In Node the name model is not available, so names would stay in.
// 2. That payload is sent with the same code as the app (runTagging), then
//    the labels are merged twice, with theme names in English and in German.
// 3. The answers, the payload and the run's settings are written to the file.
//
// With a key this costs real money: about five US cents with Claude Haiku 5.5.
// The key is only read from the environment and never printed or stored.
import { execSync, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'
import { PRICES } from '../core/ai/cost.ts'
import { DEMO_FORMAT, replayDemo, storedAnswer, type DemoRun } from '../core/ai/demo.ts'
import { KINDS, MERGE_SCHEMA, runMerge } from '../core/ai/merge.ts'
import { BATCH_SIZE, buildPayload, mergeInstructions, type AnalysisPayload, type ThemeLanguage } from '../core/ai/payload.ts'
import { runTagging, type BatchReply } from '../core/ai/run.ts'
import { anthropicJsonRequest, anthropicTaggingRequest, batchContent, EFFORT, MAX_TOKENS } from '../core/ai/tagging.ts'
import { countThemes } from '../core/ai/themes.ts'
import { guessFeedbackColumn, suggestRoles } from '../core/columns/roles.ts'
import { readCsv } from '../core/import/csv.ts'
import { itemsFromTable } from '../core/items/table.ts'
import { placeOf } from '../core/items/types.ts'
import { post } from './ai-post.ts'
import { workerPath } from './eval-browser.ts'

const OUT = 'data/demo/analysis.json'
const PORT = 4185
const BASE = `http://localhost:${PORT}`
const LANGUAGES: ThemeLanguage[] = ['en', 'de']

const { values } = parseArgs({ options: { 'stand-in': { type: 'boolean', default: false }, 'model': { type: 'string', default: 'claude-haiku-5-5' } } })
const standIn = values['stand-in']
const model = values.model
const key = process.env.ANTHROPIC_API_KEY?.trim() ?? ''
if (!standIn && !key) {
  console.error('Set ANTHROPIC_API_KEY to run this (about five US cents), or use --stand-in to build without one.')
  process.exit(2)
}

// ── 1. The payload, from the built app ─────────────────────────────────────
async function payloadFromApp(): Promise<AnalysisPayload> {
  workerPath() // fails early if there is no build
  const server = spawn(process.execPath, ['scripts/serve-static.ts', '--port', String(PORT)], { stdio: 'ignore' })
  const browser = await chromium.launch()
  try {
    for (let attempt = 0; attempt < 50 && !(await fetch(BASE).then(response => response.ok, () => false)); attempt++) await new Promise(resolve => setTimeout(resolve, 100))
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
    await page.goto(BASE)
    await page.waitForFunction(() => (document.getElementById('__nuxt') as unknown as { __vue_app__?: { $nuxt?: { isHydrating?: boolean } } })?.__vue_app__?.$nuxt?.isHydrating === false)
    await page.getByRole('button', { name: 'Try an example' }).click()
    await page.getByRole('button', { name: 'Open the sample' }).click()
    console.log('Getting the name model…')
    const download = page.getByRole('button', { name: /^Download name model/ })
    const stored = page.getByText(/^Name model stored in this browser/)
    await download.or(stored).waitFor()
    if (await download.isVisible()) await download.click()
    await stored.waitFor({ timeout: 180_000 })
    await page.getByRole('button', { name: /^Find personal data in/ }).click()
    console.log('Checking names and places…')
    await page.getByText('Names and places checked.', { exact: true }).waitFor({ timeout: 300_000 })
    const removeAll = page.getByRole('button', { name: /^Remove all [\d,]+ left$/ })
    if (await removeAll.count() > 0) await removeAll.last().click()
    await page.getByRole('link', { name: 'Continue to analyze' }).last().click()
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download exactly what will be sent (.json)' }).click()])
    const payload = JSON.parse(readFileSync(await file.path(), 'utf8')) as AnalysisPayload
    return { ...payload, provider: 'anthropic', model }
  }
  finally {
    await browser.close()
    server.kill()
  }
}

// ── Stand-in answers: invented, from words in the text, for building only ──
const STAND_IN = [
  { words: /invoice|rechnung|billing|abbuchung/i, kind: 'pains', label: 'Invoices are wrong or hard to get', job: 'Pay and file invoices' },
  { words: /log ?in|password|passwort|anmeld|account|konto/i, kind: 'pains', label: 'Cannot get into the account', job: 'Get into my account' },
  { words: /export|excel|csv|report/i, kind: 'pains', label: 'Exports are slow or incomplete', job: 'Export data for accounting' },
  { words: /great|love|good|super|danke|thanks/i, kind: 'gains', label: 'A tool that just works', job: 'Get work done quickly' },
] as const
function standInTagging(asked: string): BatchReply {
  const { texts } = JSON.parse(asked) as { texts: Array<{ id: string, text: string }> }
  const answer = {
    texts: texts.map(({ id, text }) => {
      const hits = STAND_IN.filter(entry => entry.words.test(text))
      const quote = text.split(/\s+/).slice(0, 6).join(' ')
      const tag = (label: string, intensity: number) => ({ label, intensity, quote })
      return {
        id,
        jobs: hits.slice(0, 1).map(hit => tag(hit.job, 2)),
        pains: hits.filter(hit => hit.kind === 'pains').slice(0, 1).map(hit => tag(hit.label, 3)),
        gains: hits.filter(hit => hit.kind === 'gains').slice(0, 1).map(hit => tag(hit.label, 2)),
        sentiment: hits.some(hit => hit.kind === 'pains') ? 'negative' : 'neutral',
        type: hits.some(hit => hit.kind === 'pains') ? 'complaint' : 'other',
      }
    }),
  }
  return { ok: true, body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 0, output_tokens: 0 } }) }
}
function standInMerge(asked: string, language: ThemeLanguage): BatchReply {
  const { labels } = JSON.parse(asked) as { labels: Array<{ id: string, label: string }> }
  const answer = { themes: labels.map(label => ({ name: language === 'de' ? `${label.label} (de)` : label.label, labels: [label.id] })) }
  return { ok: true, body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 0, output_tokens: 0 } }) }
}

// ── 2. The run ─────────────────────────────────────────────────────────────
const payload = await payloadFromApp()
console.log(`Payload: ${payload.texts.length} cleaned texts.`)

// The items, their rows and kept values, with the app's default column choices.
const table = readCsv('support-tickets.csv', new Uint8Array(readFileSync('data/sample/support-tickets.csv')))
const roles = suggestRoles(table).map(suggestion => suggestion.role)
const feedbackColumn = guessFeedbackColumn(table)
roles[feedbackColumn!] = 'scan'
const set = itemsFromTable(table, roles, { feedbackColumn })
const sent = set.items.filter(item => item.display !== 'short')
if (sent.length !== payload.texts.length) throw new Error(`The app sent ${payload.texts.length} texts, but the default columns give ${sent.length}. Are the column suggestions the same?`)
const { itemOf } = buildPayload(sent.map(item => ({ item: item.id, text: item.text })), 'anthropic', model)
const units = new Map(set.units.map(unit => [unit.id, unit]))
const items: DemoRun['items'] = Object.fromEntries(sent.map((item) => {
  const unit = units.get(item.unit)!
  return [item.id, { row: placeOf(unit.source).number, attributes: unit.attributes }]
}))

const usage = { input: 0, output: 0 }
const count = (body: string) => {
  const answer = JSON.parse(body) as { usage?: { input_tokens?: number, output_tokens?: number } }
  usage.input += answer.usage?.input_tokens ?? 0
  usage.output += answer.usage?.output_tokens ?? 0
}

const tagging = new Map<string, string>()
console.log(standIn ? 'Tagging with invented answers…' : `Tagging with ${model}…`)
const result = await runTagging({
  payload,
  signal: new AbortController().signal,
  onProgress: (done, total) => process.stdout.write(`\r  ${done} of ${total}`),
  send: async (batch) => {
    const asked = batchContent(batch)
    const reply = standIn ? standInTagging(asked) : await post(anthropicTaggingRequest(key, payload, batch))
    if (reply.ok) {
      count(reply.body)
      tagging.set(asked, storedAnswer(reply.body))
    }
    return reply
  },
})
console.log('')
if (result.stopped || result.failed.size > 0) throw new Error(`Tagging did not finish (${result.stopped ?? `${result.failed.size} texts not analyzed`}); nothing was written.`)

const merge = {} as DemoRun['merge']
for (const language of LANGUAGES) {
  const answers = new Map<string, string>()
  console.log(`Merging, theme names in ${language === 'en' ? 'English' : 'German'}…`)
  const merged = await runMerge({
    tagged: result.tagged,
    provider: 'anthropic',
    signal: new AbortController().signal,
    send: async (asked) => {
      const reply = standIn ? standInMerge(asked, language) : await post(anthropicJsonRequest(key, model, mergeInstructions(language), asked, MERGE_SCHEMA))
      if (reply.ok) {
        count(reply.body)
        answers.set(asked, storedAnswer(reply.body))
      }
      return reply
    },
  })
  if (merged.stopped) throw new Error(`Merging in ${language} stopped (${merged.stopped}); nothing was written.`)
  merge[language] = [...answers].map(([asked, answer]) => ({ asked, answer }))
}

// ── 3. The file ────────────────────────────────────────────────────────────
const demo: DemoRun = {
  format: DEMO_FORMAT,
  createdAt: new Date().toISOString(),
  painfoldVersion: (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version,
  commit: execSync('git rev-parse --short HEAD').toString().trim(),
  provider: 'anthropic',
  model,
  settings: { batchSize: BATCH_SIZE, effort: EFFORT, maxTokens: MAX_TOKENS },
  standIn,
  payload,
  itemOf: [...itemOf],
  items,
  tagging: [...tagging].map(([asked, answer]) => ({ asked, answer })),
  merge,
}

// The file must replay to the same result before it is kept.
for (const language of LANGUAGES) {
  const replay = await replayDemo(demo, language)
  if (replay.result.failed.size > 0 || replay.result.stopped || replay.merge.stopped) throw new Error(`The stored run does not replay in ${language}; nothing was written.`)
}

mkdirSync('data/demo', { recursive: true })
writeFileSync(OUT, `${JSON.stringify(demo, null, 1)}\n`)
const themes = countThemes(result.tagged, (await replayDemo(demo, 'en')).merge.themes, itemOf)
const price = PRICES[model]
console.log(`\nWrote ${OUT}${standIn ? ' (stand-in: invented answers)' : ''}.`)
console.log(`Texts analyzed: ${result.tagged.size}; quotes dropped: ${result.droppedQuotes}; themes: ${KINDS.map(kind => `${themes[kind].length} ${kind}`).join(', ')}.`)
if (!standIn) console.log(`Tokens: ${usage.input} in, ${usage.output} out${price ? `, about $${((usage.input * price.input + usage.output * price.output) / 1_000_000).toFixed(4)}` : ''}.`)
