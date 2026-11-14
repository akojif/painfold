import { readFileSync } from 'node:fs'
import type { Download, Page } from '@playwright/test'
import { buildPayload, INSTRUCTIONS, PAYLOAD_FORMAT } from '../../core/ai/payload'
import { guessFeedbackColumn, suggestRoles } from '../../core/columns/roles'
import { detectItems } from '../../core/detect/items'
import { readCsv } from '../../core/import/csv'
import { itemsFromTable, textItems } from '../../core/items/table'
import { Review } from '../../core/review/review'
import { expect, test } from './fixtures'

// Stage 3, slice 3 (#125): what will be sent, shown before anything is sent.
// The page is not linked yet, so these tests reach it through the app's router,
// which keeps the reviewed file in memory, as the stepper will in slice 4.
test.use({ allowedOrigins: ['https://api.anthropic.com', 'http://localhost:11434'] })

async function reviewSample(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the sample file' }).click()
  await page.getByRole('button', { name: /^Find personal data in/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
}

async function openAnalyze(page: Page) {
  await page.evaluate(() => (document.querySelector('#__nuxt') as unknown as { __vue_app__: { config: { globalProperties: { $router: { push: (to: string) => Promise<void> } } } } }).__vue_app__.config.globalProperties.$router.push('/analyze/'))
  await expect(page.getByRole('heading', { name: 'What will be sent' })).toBeVisible()
}

async function text(download: Download) {
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/** The payload the sample gives, built here, independently of the page, by the same steps. */
function expectedPayload() {
  const table = readCsv('support-tickets.csv', new Uint8Array(readFileSync(new URL('../../data/sample/support-tickets.csv', import.meta.url))))
  const roles = suggestRoles(table).map(suggestion => suggestion.role)
  roles[guessFeedbackColumn(table)!] = 'scan'
  const { items } = itemsFromTable(table, roles, { feedbackColumn: guessFeedbackColumn(table) })
  const review = new Review(items, detectItems(textItems(items)))
  const texts = items.filter(item => item.display !== 'short')
  return { review, payload: buildPayload(texts.map(item => ({ item: item.id, text: review.cleanedItem(item.id) })), 'anthropic', 'claude-haiku-5-5').payload }
}

test('without a reviewed file, says to open and review one first', async ({ page }) => {
  await page.goto('/analyze/')
  await expect(page.getByText('Open a file and review it first: only cleaned text can be sent.')).toBeVisible()
})

test('shows how many cleaned texts go where, the terms, what is not sent, and the cost, before anything is sent', async ({ page }) => {
  const { payload } = expectedPayload()
  await reviewSample(page)
  await openAnalyze(page)
  const section = page.getByRole('region', { name: 'What will be sent' })
  await expect(section).toContainText(`${payload.texts.length} cleaned texts from support-tickets.csv`)
  await expect(section).toContainText('Anthropic, Claude Haiku 5.5, straight from this browser to api.anthropic.com')
  await expect(section).toContainText('does not use them for training')
  await expect(section).toContainText('Your file, the personal data you removed, the column names, short values such as a channel or a plan, and the columns you kept as they are.')
  await expect(section).toContainText(/About [\d,]+ tokens, roughly \$[\d.]+ to \$[\d.]+\./)
  await expect(section.getByRole('listitem')).toHaveCount(20)
  // Short values such as a channel, a plan or a country are not feedback, and are not sent.
  expect(payload.texts.every(entry => entry.text.length > 3)).toBe(true)
  await expect(section).not.toContainText(/^t\d+\s*(?:Email|Solo|GB|Chat)$/m)
  await expect(section.getByRole('button', { name: `Show all ${payload.texts.length}` })).toBeVisible()
})

test('the downloaded file is exactly the payload: the instructions and every cleaned text with its id, named by provider, model and date', async ({ page }) => {
  const { payload, review } = expectedPayload()
  await reviewSample(page)
  await openAnalyze(page)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download exactly what will be sent (.json)' }).click()])
  expect(download.suggestedFilename()).toMatch(/^painfold-payload-anthropic-claude-haiku-5-5-\d{4}-\d{2}-\d{2}\.json$/)
  const downloaded = JSON.parse(await text(download))
  expect(downloaded).toEqual(payload)
  expect(downloaded.format).toBe(PAYLOAD_FORMAT)
  expect(downloaded.instructions).toBe(INSTRUCTIONS)
  // Nothing the review removed is in it.
  const removed = review.findings.map(finding => finding.value)
  expect(removed.length).toBeGreaterThan(0)
  for (const value of removed) expect(JSON.stringify(downloaded)).not.toContain(value)
})

test('the list shows every text that will be sent, and can be searched', async ({ page }) => {
  const { payload } = expectedPayload()
  await reviewSample(page)
  await openAnalyze(page)
  const section = page.getByRole('region', { name: 'What will be sent' })
  await section.getByRole('button', { name: `Show all ${payload.texts.length}` }).click()
  while (await section.getByRole('button', { name: /^Show \d+ more$/ }).count() > 0) await section.getByRole('button', { name: /^Show \d+ more$/ }).click()
  await expect(section.getByRole('listitem')).toHaveCount(payload.texts.length)
  await expect(section.getByRole('listitem').first()).toContainText(payload.texts[0]!.text)
  await section.getByLabel('Search the texts').fill('[EMAIL_')
  const withEmail = payload.texts.filter(entry => entry.text.toLowerCase().includes('[email_')).length
  await expect(section.getByRole('listitem')).toHaveCount(Math.min(20, withEmail))
})

test('nothing is sent from the consent step: no request to Anthropic or Ollama', async ({ page }) => {
  const sent: string[] = []
  for (const origin of ['https://api.anthropic.com', 'http://localhost:11434']) await page.route(`${origin}/**`, route => (sent.push(route.request().url()), route.abort()))
  await reviewSample(page)
  await openAnalyze(page)
  const section = page.getByRole('region', { name: 'What will be sent' })
  await section.getByRole('button', { name: /^Show all/ }).click()
  await section.getByLabel('Search the texts').fill('export')
  await Promise.all([page.waitForEvent('download'), section.getByRole('button', { name: /^Download exactly/ }).click()])
  await expect(section.getByRole('button', { name: /^Send \d+ cleaned texts to Anthropic$/ })).toBeDisabled()
  expect(sent).toEqual([])
})

test('when names were not checked, says so and asks for a confirmation', async ({ page }) => {
  await reviewSample(page)
  await openAnalyze(page)
  const section = page.getByRole('region', { name: 'What will be sent' })
  await expect(section).toContainText('Names were not checked, so these texts may still contain names.')
  await expect(section.getByRole('link', { name: 'Check names first' })).toBeVisible()
  await expect(section.getByLabel('I have checked these texts for names, or they contain none.')).not.toBeChecked()
})

test('the privacy notice says that only approved cleaned text goes to the chosen AI', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Only the cleaned text you approve is sent to the AI you choose.').first()).toBeVisible()
  await page.goto('/roadmap/')
  await expect(page.locator('footer')).toContainText('Only the cleaned text you approve is sent to the AI you choose.')
})
