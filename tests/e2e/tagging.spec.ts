import type { Download, Page, Route } from '@playwright/test'
import { expect, test } from './fixtures'

// Stage 3, slices 4 and 5 (#126, #127): sending the payload, checking the
// answers, and merging the labels found into themes.
// Playwright stands in for Anthropic and answers each batch from what it got.
// The key is invented; nothing reaches Anthropic.
test.use({ allowedOrigins: ['https://api.anthropic.com', 'http://localhost:11434'] })

type Sent = { id: string, text: string }
type Label = { id: string, label: string, count: number }

async function reviewSampleAndOpenAnalyze(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the sample file' }).click()
  await page.getByRole('button', { name: /^Find personal data in/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
  await page.evaluate(() => (document.querySelector('#__nuxt') as unknown as { __vue_app__: { config: { globalProperties: { $router: { push: (to: string) => Promise<void> } } } } }).__vue_app__.config.globalProperties.$router.push('/analyze/'))
  await page.getByLabel('API key', { exact: true }).fill('sk-ant-invented-test-key')
  await page.getByLabel('I have checked these texts for names, or they contain none.').check()
}

const sendButton = (page: Page) => page.getByRole('button', { name: /^Send \d+ cleaned texts to Anthropic$/ })

/** Answers a batch: one pain per text, quoting its first words, or a quote that is not in the text for `wrongQuote`. */
function answer(route: Route, texts: Sent[], wrongQuote?: string) {
  const answerJson = JSON.stringify({ texts: texts.map(({ id, text }) => ({ id, jobs: [], pains: [{ label: 'Slow exports', intensity: 2, quote: id === wrongQuote ? 'words that are not there' : text.slice(0, 12) }], gains: [], sentiment: 'negative', type: 'complaint' })) })
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: answerJson }], usage: { input_tokens: 1000, output_tokens: 500 } }) })
}

const contentOf = (route: Route) => JSON.parse(JSON.parse(route.request().postData()!).messages[0].content)
const batchOf = (route: Route): Sent[] => contentOf(route).texts
const isMerge = (route: Route) => 'kind' in contentOf(route)

/** Answers a merge request: all labels in one theme. */
function merged(route: Route) {
  const { labels } = contentOf(route) as { labels: Label[] }
  const answerJson = JSON.stringify({ themes: labels.length ? [{ name: 'Exports are slow', labels: labels.map(label => label.id) }] : [] })
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: answerJson }], usage: { input_tokens: 100, output_tokens: 50 } }) })
}

async function text(download: Download) {
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

test('the requests hold exactly the downloaded payload, sent only after the click, and the run ends with a summary', async ({ page }) => {
  const bodies: Array<{ model: string, system: string, texts: Sent[] }> = []
  await page.route('https://api.anthropic.com/**', (route) => {
    if (isMerge(route)) return merged(route)
    const body = JSON.parse(route.request().postData()!)
    bodies.push({ model: body.model, system: body.system, texts: batchOf(route) })
    return answer(route, batchOf(route), 't3')
  })
  await reviewSampleAndOpenAnalyze(page)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download exactly what will be sent (.json)' }).click()])
  const payload = JSON.parse(await text(download))
  expect(bodies).toHaveLength(0)

  await sendButton(page).click()
  const run = page.getByRole('region', { name: /^Analyz(?:ing|ed) \d+ cleaned texts with Claude Haiku 5\.5$/ })
  await expect(run).toContainText(`${payload.texts.length} texts analyzed.`)
  await expect(run).toContainText('1 quote did not match its text word for word and was left out.')
  await expect(run).toContainText('Grouped into 0 jobs, 1 pain and 0 gains.')

  expect(bodies.length).toBe(Math.ceil(payload.texts.length / 25))
  for (const body of bodies) {
    expect(body.model).toBe(payload.model)
    expect(body.system).toBe(payload.instructions)
  }
  const sent = bodies.flatMap(body => body.texts).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
  expect(sent).toEqual(payload.texts)
})

test('the send button waits for a key and for the names confirmation', async ({ page }) => {
  await reviewSampleAndOpenAnalyze(page)
  await page.getByLabel('API key', { exact: true }).fill('')
  await expect(sendButton(page)).toBeDisabled()
  await expect(page.getByText('Enter your API key above first.')).toBeVisible()
  await page.getByLabel('API key', { exact: true }).fill('sk-ant-invented-test-key')
  await page.getByLabel('I have checked these texts for names, or they contain none.').uncheck()
  await expect(page.getByText('Confirm the line about names first.')).toBeVisible()
  await expect(sendButton(page)).toBeDisabled()
})

test('an invalid key pauses the run with the reason; Resume sends only what is left, never a text twice', async ({ page }) => {
  const sent: string[] = []
  let keyWorks = false
  await page.route('https://api.anthropic.com/**', (route) => {
    if (isMerge(route)) return merged(route)
    if (!keyWorks) return route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":{"type":"authentication_error","message":"invalid x-api-key"}}' })
    sent.push(...batchOf(route).map(entry => entry.id))
    return answer(route, batchOf(route))
  })
  await reviewSampleAndOpenAnalyze(page)
  await sendButton(page).click()
  const run = page.getByRole('region', { name: /^Analyz(?:ing|ed)/ })
  await expect(run).toContainText('Anthropic did not accept this key. Check it and try again.')
  await expect(run).toContainText(/Paused at 0 of \d+\. Resume sends only the texts not analyzed yet\./)

  keyWorks = true
  await run.getByRole('button', { name: 'Resume' }).click()
  await expect(run).toContainText(/\d+ texts analyzed\./)
  expect(new Set(sent).size).toBe(sent.length)
})

test('Cancel lets the requests in flight finish, sends nothing new, and Resume completes without sending a text twice', async ({ page }) => {
  const sent: string[] = []
  let release: () => void = () => {}
  const held = new Promise<void>(resolve => (release = resolve))
  await page.route('https://api.anthropic.com/**', async (route) => {
    if (isMerge(route)) return merged(route)
    const batch = batchOf(route)
    sent.push(...batch.map(entry => entry.id))
    if (sent.length > 50) await held
    return answer(route, batch)
  })
  await reviewSampleAndOpenAnalyze(page)
  await sendButton(page).click()
  const run = page.getByRole('region', { name: /^Analyz(?:ing|ed)/ })
  await expect.poll(() => sent.length).toBeGreaterThan(50)
  await run.getByRole('button', { name: 'Cancel' }).click()
  await expect(run).toContainText('Stopping: the requests already sent are finishing, nothing new is sent.')
  const whenCancelled = sent.length
  release()
  await expect(run).toContainText(/Stopped: \d+ of \d+ texts are analyzed\. Nothing more was sent\./)
  expect(sent.length).toBe(whenCancelled)

  await run.getByRole('button', { name: 'Resume' }).click()
  await expect(run).toContainText(/\d+ texts analyzed\./)
  expect(new Set(sent).size).toBe(sent.length)
})

test('merging sends only the labels found, under the merge instructions shown before sending, never a text or a quote', async ({ page }) => {
  const merges: Array<{ system: string, kind: string, labels: Label[] }> = []
  const texts: Sent[] = []
  await page.route('https://api.anthropic.com/**', (route) => {
    if (isMerge(route)) {
      merges.push({ system: JSON.parse(route.request().postData()!).system, ...contentOf(route) })
      return merged(route)
    }
    texts.push(...batchOf(route))
    return answer(route, batchOf(route))
  })
  await reviewSampleAndOpenAnalyze(page)
  await expect(page.getByText('The short labels the AI found, such as “Export takes too long”, go back to it once more, to group similar ones. Never the texts or quotes.')).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download exactly what will be sent (.json)' }).click()])
  const payload = JSON.parse(await text(download))
  await sendButton(page).click()
  await expect(page.getByRole('region', { name: /^Analyzed/ })).toContainText('Grouped into')

  expect(merges.map(merge => merge.kind)).toEqual(['pains'])
  expect(merges[0]!.system).toBe(payload.mergeInstructions)
  // The mock tags every text with the same pain, so one label from all of them.
  expect(merges[0]!.labels).toEqual([{ id: 'l1', label: 'Slow exports', count: texts.length }])
  const sent = JSON.stringify(merges)
  for (const { text: feedback } of texts) expect(sent).not.toContain(feedback.slice(0, 12))
})
