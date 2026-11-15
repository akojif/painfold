import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { replayDemo, type DemoRun } from '../../core/ai/demo'
import { countThemes } from '../../core/ai/themes'
import { expect, test } from './fixtures'

// Demo mode (#130): a stored real run on the sample file, shown with the real
// report. It sends nothing: every test also fails if the page contacts any
// other origin (fixtures.ts), and the AI endpoint is watched here as well.
const demo = JSON.parse(readFileSync('data/demo/analysis.json', 'utf8')) as DemoRun

/** The report's numbers, replayed here, independently of the page. */
async function expected(language: 'en' | 'de') {
  const { result, merge, itemOf } = await replayDemo(demo, language)
  return countThemes(result.tagged, merge.themes, itemOf)
}

/** Any request to the AI fails the test, whatever its origin rules. */
async function noAi(page: Page) {
  const asked: string[] = []
  await page.route(/api\.anthropic\.com|localhost:11434|127\.0\.0\.1:11434/, (route) => {
    asked.push(route.request().url())
    return route.abort()
  })
  return asked
}

const outbound = (page: Page) => page.getByRole('button', { name: /What leaves your browser|Was Ihren Browser verlässt/ })
const note = (page: Page) => page.getByRole('note')

test('from the start page, the demo report opens without importing anything, sends nothing and says it is a demo', async ({ page }) => {
  const asked = await noAi(page)
  const themes = await expected('en')
  await page.goto('/')
  await page.getByRole('button', { name: 'Or see a finished demo analysis, no API key needed' }).click()
  await expect(page).toHaveURL(/\/report\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What customers said')
  await expect(note(page)).toContainText('Demo with made-up data.')
  await expect(note(page)).toContainText('No file is open here: rows refer to the sample file.')
  await expect(outbound(page)).toContainText('0 bytes')
  // No file is open: no steps claiming an import, and no cleaned file to offer.
  await expect(page.getByRole('navigation', { name: 'Steps' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'The cleaned file' })).toHaveCount(0)

  // The numbers are the replay's, counted in code.
  const top = themes.pains[0] ?? themes.jobs[0]!
  const entry = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: top.name, exact: true }) }).first()
  await expect(entry).toContainText(String(top.count))
  // A row opens its stored text, with its row number from the sample.
  const source = page.getByRole('button', { name: /^Row \d+$/ }).first()
  await source.click()
  await expect(page.locator(`#${await source.getAttribute('aria-controls')}`)).not.toBeEmpty()
  expect(asked).toEqual([])
})

test('the German start page opens the German demo report, with German theme names', async ({ page }) => {
  const asked = await noAi(page)
  const themes = await expected('de')
  await page.goto('/de/')
  await page.getByRole('button', { name: 'Oder eine fertige Demo-Analyse ansehen, ohne API-Schlüssel' }).click()
  await expect(page).toHaveURL(/\/de\/report\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Was Ihre Kunden sagen')
  await expect(note(page)).toContainText('Demo mit erfundenen Daten.')
  await expect(outbound(page)).toContainText('0 Bytes')
  const first = [...themes.jobs, ...themes.pains, ...themes.gains][0]!
  await expect(page.getByRole('heading', { name: first.name, exact: true }).first()).toBeVisible()
  expect(asked).toEqual([])
})

test('switching the language on the demo report renames the themes, still without a request', async ({ page }) => {
  const asked = await noAi(page)
  const german = await expected('de')
  await page.goto('/')
  await page.getByRole('button', { name: 'Or see a finished demo analysis, no API key needed' }).click()
  await expect(note(page)).toBeVisible()
  await page.getByRole('button', { name: 'German' }).click()
  await expect(page).toHaveURL(/\/de\/report\/$/)
  const first = [...german.jobs, ...german.pains, ...german.gains][0]!
  await expect(page.getByRole('heading', { name: first.name, exact: true }).first()).toBeVisible()
  expect(asked).toEqual([])
})

test('on Analyze, the sample offers the demo; it opens the report, and leaving it returns to a normal analysis', async ({ page }) => {
  const asked = await noAi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the sample file' }).click()
  await page.getByRole('button', { name: /^Find personal data in/ }).click()
  await page.getByRole('link', { name: 'Continue to analyze' }).last().click()
  await expect(page.getByText(/^No API key\? See a demo analysis of this sample/)).toBeVisible()
  await page.getByRole('button', { name: 'Show the demo analysis' }).click()
  await expect(page).toHaveURL(/\/report\/$/)
  await expect(note(page)).toContainText('Demo with made-up data.')
  await expect(note(page)).not.toContainText('No file is open here')
  await expect(page.getByRole('navigation', { name: 'Steps' }).locator('[aria-current="step"]')).toHaveText(/Report/)
  await expect(outbound(page)).toContainText('0 bytes')

  await page.getByRole('button', { name: 'Analyze a file yourself' }).click()
  await expect(page).toHaveURL(/\/analyze\/$/)
  await expect(page.getByRole('button', { name: 'Show the demo analysis' })).toBeVisible()
  expect(asked).toEqual([])
})

test('another file is not offered the demo', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({ name: 'feedback.csv', mimeType: 'text/csv', buffer: Buffer.from('feedback\nThe export to Excel is slow.\nInvoices show the old address.\n') })
  await page.getByRole('button', { name: /^Find personal data in/ }).click()
  await page.getByRole('link', { name: 'Continue to analyze' }).last().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Where should the analysis run?')
  await expect(page.getByRole('button', { name: 'Show the demo analysis' })).toHaveCount(0)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('the demo line opens the bigger-screen sheet, like the other start actions', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Or see a finished demo analysis, no API key needed' }).tap()
    await expect(page.getByRole('dialog', { name: 'Painfold likes a bigger screen' })).toBeVisible()
  })
})
