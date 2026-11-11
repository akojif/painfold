import { readFileSync } from 'node:fs'
import type { BrowserContext, Download, Page } from '@playwright/test'
import { expect, test as freshBrowser, waitForHydrationOnGoto } from './fixtures'

// Names and places found in the background while the rule findings are
// reviewed (ROADMAP Stage 2, #65). The tests that use the name model share one
// browser per worker: the first downloads the model (152 MB, from the local
// build), the rest find it stored, as on a later visit, and each still opens
// its own page with a fresh app. The test without the model uses a fresh
// browser.
const test = freshBrowser.extend<object, { modelBrowser: BrowserContext }>({
  modelBrowser: [async ({ browser }, use, workerInfo) => {
    const context = await browser.newContext({ baseURL: workerInfo.project.use.baseURL })
    await use(context)
    await context.close()
  }, { scope: 'worker' }],
  page: async ({ modelBrowser }, use) => {
    const page = await modelBrowser.newPage()
    await use(waitForHydrationOnGoto(page))
    await page.close()
  },
})

const sampleCsv = readFileSync(new URL('../../data/sample/support-tickets.csv', import.meta.url), 'utf8')
// The sample three times (600 rows): names arrive in batches of 100 while
// someone reviews, and the check runs long enough to stop it.
const [header, ...lines] = sampleCsv.trim().split('\n')
const mediumCsv = [header, ...Array.from({ length: 3 }, () => lines).flat()].join('\n')

test.describe.configure({ timeout: 240_000 })

const text = async (download: Download) => readFileSync((await download.path())!, 'utf8')

/** Opens a file with the name model ready: downloaded if this worker's browser does not have it yet. */
async function withModel(page: Page, open: () => Promise<void>, path = '/') {
  await page.goto(path)
  await open()
  const download = page.getByRole('button', { name: /^(Download name model|Namensmodell herunterladen)/ })
  const stored = page.getByText(/^(Name model stored in this browser|Namensmodell in diesem Browser gespeichert)/)
  await expect(download.or(stored)).toBeVisible()
  if (await download.isVisible()) await download.click()
  await expect(stored).toBeVisible({ timeout: 60_000 })
}
const sample = (page: Page) => () => page.getByRole('button', { name: 'Try the sample file' }).click()
const upload = (csv: string) => (page: Page) => () => page.getByTestId('file-input').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
const medium = upload(mediumCsv)
const findButton = (page: Page) => page.getByRole('button', { name: /^Find personal data in/ })
const heading = (page: Page) => page.getByRole('heading', { level: 1 })
const findings = async (page: Page) => Number((await heading(page).innerText()).match(/^([\d,]+) findings/)![1]!.replace(/,/g, ''))

test('rule findings can be reviewed at once; names arrive in the background without moving focus', async ({ page }) => {
  await withModel(page, medium(page))
  await findButton(page).click()
  await expect(heading(page)).toHaveText(/findings in 600 rows$/)
  const before = await findings(page)
  await expect(page.getByText(/^Checking for names: [\d,]+ of 600 rows$/)).toBeVisible()

  // Review a rule finding with the keyboard while names arrive.
  const first = page.locator('[data-value]').first()
  await first.focus()
  const focused = await first.getAttribute('data-value')
  await page.keyboard.press('k')
  const next = await page.evaluate(() => document.activeElement?.getAttribute('data-value'))
  expect(next).not.toBe(focused)

  await expect(page.getByText('Names and places checked.', { exact: true })).toBeVisible({ timeout: 180_000 })
  await expect(page.getByText(/^Names checked: [\d,]+ names? and [\d,]+ places? added\.$/)).toBeAttached()
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-value'))).toBe(next)
  expect(await findings(page)).toBeGreaterThan(before)
  await expect(page.getByRole('heading', { name: 'Names', exact: true })).toBeVisible()
})

test('the download waits while names are checked, and the cleaned file has them removed', async ({ page }) => {
  await withModel(page, sample(page))
  await findButton(page).click()
  const waiting = page.getByText('The download is available when names are checked.')
  const done = page.getByText('Names and places checked.', { exact: true })
  // On a fast machine the 200 rows may already be done; either way the button follows the state.
  await expect(waiting.or(done)).toBeVisible()
  if (await waiting.isVisible()) await expect(page.getByRole('button', { name: 'Continue to download' })).toBeDisabled()
  await expect(done).toBeVisible({ timeout: 60_000 })
  await expect(waiting).toBeHidden()

  await page.getByRole('link', { name: 'Continue to download' }).last().click()
  await expect(page.getByText('Names and places were checked with the name model.')).toBeVisible()
  const [csvDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download support-tickets_cleaned/ }).click()])
  const csv = await text(csvDownload)
  expect(csv).not.toContain('Chloe Merriweather-Stone')
  expect(csv).toContain('[NAME_1]')
  const [reportDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download cleaning report (.txt)' }).click()])
  const report = await text(reportDownload)
  expect(report).toContain('Davlan/distilbert-base-multilingual-cased-ner-hrl')
  expect(report).toContain('Names and places were checked with the name model.')
})

test('Stop asks first; skipping is recorded, and names can still be checked after all', async ({ page }) => {
  await withModel(page, medium(page))
  await findButton(page).click()
  await expect(page.getByText(/^Checking for names:/)).toBeVisible()

  await page.getByRole('button', { name: 'Stop' }).click()
  const dialog = page.getByRole('dialog', { name: 'Skip names for this file?' })
  await expect(dialog).toContainText('Names won\'t be removed from the download.')
  await dialog.getByRole('button', { name: 'Keep checking' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(/^Checking for names:/)).toBeVisible()

  await page.getByRole('button', { name: 'Stop' }).click()
  await dialog.getByRole('button', { name: 'Skip names' }).click()
  await expect(page.getByText(/^Names were (checked in [\d,]+ of 600 rows, then skipped|skipped for this file)/)).toBeVisible()
  await expect(page.getByText('The download is available when names are checked.')).toBeHidden()

  await page.getByRole('link', { name: 'Continue to download' }).last().click()
  await expect(page.getByText(/^Names were (checked in [\d,]+ of 600 rows; the check was skipped|not checked: the check was skipped)/)).toBeVisible()
  const [reportDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download cleaning report (.txt)' }).click()])
  expect(await text(reportDownload)).toMatch(/Names were (checked in [\d,]+ of 600 rows; the check was|not checked: the check was)/)

  await page.getByRole('link', { name: 'Back to review' }).click()
  await page.getByRole('button', { name: 'Check names after all' }).click()
  await expect(page.getByText('Names and places checked.', { exact: true })).toBeVisible({ timeout: 200_000 })
})

freshBrowser('without the name model, the review and the download say names were not checked', async ({ page }) => {
  await page.goto('/')
  await sample(page)()
  await findButton(page).click()
  await expect(page.getByText('Names aren\'t checked.')).toBeVisible()
  await expect(page.getByText('The download is available when names are checked.')).toBeHidden()
  await page.getByRole('link', { name: 'Continue to download' }).last().click()
  await expect(page.getByText('Names and places were not checked: the name model was not downloaded.')).toBeVisible()
})

test('the German review explains the check in German', async ({ page }) => {
  await withModel(page, () => page.getByRole('button', { name: 'Beispieldatei ausprobieren' }).click(), '/de')
  await page.getByRole('button', { name: /^Personenbezogene Daten in/ }).click()
  await expect(page.getByText('Namen und Orte geprüft.', { exact: true })).toBeVisible({ timeout: 60_000 })
})
