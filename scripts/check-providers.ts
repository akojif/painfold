// Checks which AI providers a page on https://painfold.com can call straight
// from the browser (Stage 3, slice 1, #123). Run: npm run check:providers
//
// A Chromium page is served at the production origin (by Playwright, locally:
// nothing is fetched from painfold.com). From it, each provider gets one tiny
// request, the text "Hello", with a fake key. The browser only lets the page
// read the answer, even an error, if the provider allows calls from this
// origin (CORS). So the fake key is enough to tell "browser access works"
// (the page reads a status such as 401) from "blocked" (the page gets nothing).
//
// With a real key in the environment (ANTHROPIC_API_KEY, OPENAI_API_KEY,
// MISTRAL_API_KEY), that provider is also asked for a real, short answer, to
// confirm a successful response is readable too. Keys are never printed or
// stored. No feedback text is ever sent: only the fixed word "Hello".
//
// Ollama (local) is checked in Chromium, Firefox and WebKit, against a running
// Ollama started with OLLAMA_ORIGINS=https://painfold.com and the model in
// OLLAMA_MODEL (default llama3.2:3b). In Chromium the check grants the local
// network permission, as a person does when Chrome asks; without it, Chrome
// blocks the call.
import { chromium, firefox, webkit, type BrowserType } from '@playwright/test'

const ORIGIN = 'https://painfold.com'
const FAKE_KEY = 'painfold-cors-check-not-a-key'
const TEXT = 'Hello'

type Check = { provider: string, url: string, headers: Record<string, string>, body: unknown, realKey?: string }

const checks = (keys: Record<string, string | undefined>): Check[] => {
  const anthropic = (key: string, browserHeader: boolean): Check => ({
    provider: `Anthropic${browserHeader ? '' : ' (without the browser header)'}`,
    url: 'https://api.anthropic.com/v1/messages',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      ...(browserHeader ? { 'anthropic-dangerous-direct-browser-access': 'true' } : {}),
    },
    body: { model: 'claude-haiku-5-5', max_tokens: 16, messages: [{ role: 'user', content: TEXT }] },
  })
  const openAiStyle = (provider: string, url: string, model: string, key: string): Check => ({
    provider,
    url,
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${key}` },
    body: { model, max_tokens: 16, messages: [{ role: 'user', content: TEXT }] },
  })
  return [
    { ...anthropic(keys.anthropic ?? FAKE_KEY, true), realKey: keys.anthropic },
    anthropic(FAKE_KEY, false),
    { ...openAiStyle('OpenAI', 'https://api.openai.com/v1/chat/completions', 'gpt-4.1-nano', keys.openai ?? FAKE_KEY), realKey: keys.openai },
    { ...openAiStyle('Mistral', 'https://api.mistral.ai/v1/chat/completions', 'ministral-8b-latest', keys.mistral ?? FAKE_KEY), realKey: keys.mistral },
    { ...openAiStyle('Mistral, EU endpoint', 'https://api.eu.mistral.ai/v1/chat/completions', 'ministral-8b-latest', keys.mistral ?? FAKE_KEY), realKey: keys.mistral },
  ]
}

type Result = { provider: string, readable: boolean, status?: number, allowOrigin?: string, preflight?: number, error?: string, realKey: boolean }

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()
// The production origin, served locally: the page itself never leaves this machine.
await page.route(`${ORIGIN}/**`, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Provider check</title>' }))
await page.goto(`${ORIGIN}/provider-check`)

// What the network saw, including headers the page itself cannot read.
const seen = new Map<string, { preflight?: number, allowOrigin?: string }>()
page.on('response', (response) => {
  const url = response.url()
  const entry = seen.get(url) ?? {}
  if (response.request().method() === 'OPTIONS') entry.preflight = response.status()
  else entry.allowOrigin = response.headers()['access-control-allow-origin']
  seen.set(url, entry)
})

const results: Result[] = []
for (const check of checks({ anthropic: process.env.ANTHROPIC_API_KEY, openai: process.env.OPENAI_API_KEY, mistral: process.env.MISTRAL_API_KEY })) {
  const outcome = await page.evaluate(async ({ url, headers, body }) => {
    try {
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
      return { readable: true, status: response.status }
    }
    catch (error) {
      return { readable: false, error: error instanceof Error ? error.message : String(error) }
    }
  }, check)
  const network = seen.get(check.url) ?? {}
  results.push({ provider: check.provider, ...outcome, ...network, realKey: Boolean(check.realKey) })
  seen.delete(check.url)
}
await browser.close()

// Ollama, in each browser engine. A real answer from the local model counts as browser access.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2:3b'
const engines: Array<[string, BrowserType, string[]]> = [
  ['Chromium (Chrome, Edge), local network allowed', chromium, ['local-network-access']],
  ['Chromium (Chrome, Edge), not allowed yet', chromium, []],
  ['Firefox', firefox, []],
  ['WebKit (Safari)', webkit, []],
]
// A browser cannot tell "Ollama is not running" from "blocked", so ask Ollama directly first.
const ollamaRunning = await fetch('http://127.0.0.1:11434/api/version').then(response => response.ok, () => false)
if (!ollamaRunning) console.log('Ollama is not running, so its checks are skipped. Start it with: OLLAMA_ORIGINS=https://painfold.com ollama serve\n')
for (const [engineName, engine, permissions] of ollamaRunning ? engines : []) {
  const engineBrowser = await engine.launch()
  const engineContext = await engineBrowser.newContext()
  if (permissions.length > 0) await engineContext.grantPermissions(permissions, { origin: ORIGIN })
  const enginePage = await engineContext.newPage()
  await enginePage.route(`${ORIGIN}/**`, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Provider check</title>' }))
  await enginePage.goto(`${ORIGIN}/provider-check`)
  const outcome = await enginePage.evaluate(async ({ model, text }) => {
    try {
      const response = await fetch('http://localhost:11434/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, stream: false, messages: [{ role: 'user', content: text }] }) })
      return { readable: true, status: response.status }
    }
    catch (error) {
      return { readable: false, error: error instanceof Error ? error.message : String(error) }
    }
  }, { model: OLLAMA_MODEL, text: TEXT })
  results.push({ provider: `Ollama (local), ${engineName}`, ...outcome, realKey: false })
  await engineBrowser.close()
}

console.log(`Origin: ${ORIGIN}\n`)
for (const result of results) {
  const ollama = result.provider.startsWith('Ollama')
  const verdict = result.readable ? `browser access works (status ${result.status}${ollama ? '' : result.realKey ? ', real key' : ', fake key'})` : `blocked or unreachable (${result.error})`
  console.log(`${result.provider.padEnd(62)} ${verdict}`)
  if (!ollama) console.log(`${''.padEnd(62)} access-control-allow-origin: ${result.allowOrigin ?? 'none seen'}`)
}
