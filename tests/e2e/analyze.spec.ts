import type { Page, Request, Route } from '@playwright/test'
import { expect, test } from './fixtures'

// Stage 3, slice 2 (#124): choosing where the analysis runs. Anthropic and
// Ollama are stood in for by Playwright, so no key or service is needed and
// every request the page makes is checked. The key is invented.
const KEY = 'sk-ant-invented-test-key'

// The AI endpoints the page may call; any other origin still fails a test.
test.use({ allowedOrigins: ['https://api.anthropic.com', 'http://localhost:11434'] })

function answer(route: Route, status: number, body: unknown) {
  return route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
}

async function anthropic(page: Page, status = 200, body: unknown = { content: [{ type: 'text', text: 'Hi' }] }) {
  const requests: Request[] = []
  await page.route('https://api.anthropic.com/**', (route) => {
    requests.push(route.request())
    return answer(route, status, body)
  })
  return requests
}

test('the page is not linked from the app yet, and asks not to be indexed', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('a[href*="analyze"]')).toHaveCount(0)
  await page.goto('/analyze/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Where should the analysis run?')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
})

test('the page may call Anthropic and Ollama on this computer, and nothing else', async ({ page }) => {
  await page.goto('/analyze/')
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(policy).toContain("connect-src 'self' https://api.anthropic.com http://localhost:11434 http://127.0.0.1:11434;")
})

test('Test connection sends only "Hello" to Anthropic, with the key and the browser header, and says it worked', async ({ page }) => {
  const requests = await anthropic(page)
  await page.goto('/analyze/')
  await page.getByLabel('API key', { exact: true }).fill(KEY)
  await page.getByRole('button', { name: 'Test connection' }).click()
  await expect(page.getByText('Connected to Claude Haiku 5.5.')).toBeVisible()

  expect(requests).toHaveLength(1)
  const request = requests[0]!
  expect(request.url()).toBe('https://api.anthropic.com/v1/messages')
  expect(request.headers()).toMatchObject({ 'x-api-key': KEY, 'anthropic-dangerous-direct-browser-access': 'true', 'anthropic-version': '2023-06-01' })
  expect(request.postDataJSON()).toEqual({ model: 'claude-haiku-5-5', max_tokens: 16, messages: [{ role: 'user', content: 'Hello' }] })
  expect(request.headers().cookie).toBeUndefined()
  expect(request.headers().referer).toBeUndefined()
})

test('the request to the AI is listed in "What leaves your browser", with the bytes sent', async ({ page }) => {
  await anthropic(page)
  await page.goto('/analyze/')
  await page.getByLabel('API key', { exact: true }).fill(KEY)
  await page.getByRole('button', { name: 'Test connection' }).click()
  await expect(page.getByText('Connected to Claude Haiku 5.5.')).toBeVisible()
  await page.getByRole('button', { name: /What leaves your browser/ }).click()
  const dialog = page.getByRole('dialog', { name: 'What leaves your browser' })
  await expect(dialog).toContainText('1 request went to the AI you chose.')
  const row = dialog.getByRole('row').filter({ hasText: 'api.anthropic.com' })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Sent to the AI')
  const sent = JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 16, messages: [{ role: 'user', content: 'Hello' }] }).length
  await expect(row).toContainText(`${sent} B`)
})

test('explains a key Anthropic does not accept, and an organisation that blocks browsers', async ({ page }) => {
  await anthropic(page, 401, { error: { type: 'authentication_error', message: 'invalid x-api-key' } })
  await page.goto('/analyze/')
  await page.getByLabel('API key', { exact: true }).fill(KEY)
  await page.getByRole('button', { name: 'Test connection' }).click()
  await expect(page.getByText('Anthropic did not accept this key. Check it and try again.')).toBeVisible()

  await page.unroute('https://api.anthropic.com/**')
  await anthropic(page, 401, { error: { type: 'authentication_error', message: 'CORS requests are not allowed for this Organization because of its settings.' } })
  await page.getByRole('button', { name: 'Test connection' }).click()
  await expect(page.getByText('Your Anthropic organization does not allow calls from browsers.')).toBeVisible()
})

test('asks for a key before testing, and sends nothing without one', async ({ page }) => {
  const requests = await anthropic(page)
  await page.goto('/analyze/')
  await page.getByRole('button', { name: 'Test connection' }).click()
  await expect(page.getByText('Enter your API key first.')).toBeVisible()
  expect(requests).toHaveLength(0)
})

test('keeps the key in memory only, unless asked to remember it, and forgets it when unticked', async ({ page }) => {
  await page.goto('/analyze/')
  await page.getByLabel('API key', { exact: true }).fill(KEY)
  const stored = () => page.evaluate(() => JSON.stringify({ ...localStorage }))
  expect(await stored()).not.toContain(KEY)
  await page.getByLabel('Remember on this device').check()
  await expect.poll(stored).toContain(KEY)
  await page.reload()
  await expect(page.getByLabel('API key', { exact: true })).toHaveValue(KEY)
  await page.getByLabel('Remember on this device').uncheck()
  await expect.poll(stored).not.toContain(KEY)
})

test('with Ollama, finds the models on this computer and tests one, without calling Anthropic', async ({ page }) => {
  const toAnthropic = await anthropic(page)
  const toOllama: Request[] = []
  await page.route('http://localhost:11434/**', (route) => {
    toOllama.push(route.request())
    return route.request().url().endsWith('/api/tags')
      ? answer(route, 200, { models: [{ name: 'llama3.2:3b' }, { name: 'mistral:7b' }] })
      : answer(route, 200, { message: { role: 'assistant', content: 'Hi' } })
  })
  await page.goto('/analyze/')
  await page.getByText('On this computer (Ollama)').click()
  await expect(page.getByText('Ollama is running and answers this site.')).toBeVisible()
  await expect(page.getByLabel('Model')).toHaveValue('llama3.2:3b')
  await expect(page.getByText(/launchctl setenv OLLAMA_ORIGINS|setx OLLAMA_ORIGINS|OLLAMA_ORIGINS=/)).toContainText('http://localhost')
  await page.getByRole('button', { name: 'Test connection' }).click()
  await expect(page.getByText('Connected to llama3.2:3b on this computer.')).toBeVisible()
  expect(toOllama.at(-1)!.postDataJSON()).toEqual({ model: 'llama3.2:3b', stream: false, messages: [{ role: 'user', content: 'Hello' }] })
  expect(toAnthropic).toHaveLength(0)
})

test('explains when Ollama cannot be reached', async ({ page }) => {
  await page.route('http://localhost:11434/**', route => route.abort('connectionrefused'))
  await page.goto('/analyze/')
  await page.getByText('On this computer (Ollama)').click()
  await expect(page.getByText(/Painfold cannot reach Ollama\. It may not be running/)).toBeVisible()
})

test('is in German under /de/', async ({ page }) => {
  await page.goto('/de/analyze/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wo soll die Analyse laufen?')
  await expect(page.getByText('Ihr Schlüssel geht nur an Anthropic, direkt aus diesem Browser.')).toBeVisible()
})
