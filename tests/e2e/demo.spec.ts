import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { replayDemo, type DemoRun } from '../../core/ai/demo'
import { countThemes } from '../../core/ai/themes'
import { expect, openSample, test } from './fixtures'

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

/** "Try an example", then "See a finished analysis" (ExampleDialog.vue). */
async function openDemo(page: Page, german = false) {
  await page.getByRole('button', { name: german ? 'Beispiel ausprobieren' : 'Try an example' }).click()
  await page.getByRole('radio', { name: german ? /^Fertige Analyse ansehen/ : /^See a finished analysis/ }).check()
  await page.getByRole('button', { name: german ? 'Analyse anzeigen' : 'Show the analysis' }).click()
}

const outbound = (page: Page) => page.getByRole('button', { name: /What leaves your browser|Was Ihren Browser verlässt/ })
const note = (page: Page) => page.getByRole('note')

test('from the start page, the demo report opens without importing anything, sends nothing and says it is a demo', async ({ page }) => {
  const asked = await noAi(page)
  const themes = await expected('en')
  await page.goto('/')
  await openDemo(page)
  await expect(page).toHaveURL(/\/report\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What customers said')
  await expect(note(page)).toContainText('Demo with made-up data.')
  await expect(note(page)).toContainText('No file is open here: rows refer to the sample file.')
  await expect(outbound(page)).toContainText('0 bytes')
  // No file is open: the top bar has the steps, as on every step, but claims no import,
  // links only to the report itself, and there is no cleaned file to offer.
  const steps = page.getByRole('navigation', { name: 'Steps' })
  await expect(steps.getByRole('listitem')).toHaveText([/Import/, /Review/, /Analyze/, /Report/])
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/Report/)
  await expect(steps).not.toContainText('done')
  await expect(steps.getByRole('link')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start over' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The cleaned file' })).toHaveCount(0)

  // The numbers are the replay's, counted in code.
  const top = themes.pains[0] ?? themes.jobs[0]!
  const entry = page.getByRole('row').filter({ has: page.getByRole('button', { name: top.name, exact: true }) }).first()
  await expect(entry.getByRole('cell').nth(1)).toHaveText(String(top.count))
  // Its drawer opens a stored text, with its row number from the sample.
  await entry.getByRole('button', { name: top.name, exact: true }).click()
  const drawer = page.getByRole('region', { name: top.name, exact: true })
  const source = drawer.getByRole('button', { name: /^Row \d+$/ }).first()
  await source.click()
  await expect(page.locator(`#${await source.getAttribute('aria-controls')}`)).not.toBeEmpty()

  // Start over leaves the demo for the start page.
  await page.getByRole('button', { name: 'Start over' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find what hurts your customers. Without exposing who they are.')
  await expect(page.getByRole('navigation', { name: 'Steps' })).toHaveCount(0)
  expect(asked).toEqual([])
})

test('"Try an example" offers both paths as one choice, works from the keyboard, and names what happens next', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try an example' }).click()
  const dialog = page.getByRole('dialog', { name: 'Try Painfold with made-up data' })
  await expect(dialog).toContainText('200 support tickets in German and English. No real people.')
  const sample = dialog.getByRole('radio', { name: /^Clean the sample file/ })
  const finished = dialog.getByRole('radio', { name: /^See a finished analysis/ })
  await expect(sample).toBeChecked()
  await expect(sample).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Open the sample' })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await expect(finished).toBeChecked()
  await expect(dialog.getByRole('button', { name: 'Show the analysis' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Try an example' })).toBeFocused()

  // Enter proceeds with the choice: the sample opens in the column step.
  await page.getByRole('button', { name: 'Try an example' }).click()
  await expect(sample).toBeChecked()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose what to check')
})

test('the German start page opens the German demo report, with German theme names', async ({ page }) => {
  const asked = await noAi(page)
  const themes = await expected('de')
  await page.goto('/de/')
  await openDemo(page, true)
  await expect(page).toHaveURL(/\/de\/report\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Was Ihre Kunden sagen')
  await expect(note(page)).toContainText('Demo mit erfundenen Daten.')
  await expect(outbound(page)).toContainText('0 Bytes')
  const first = [...themes.jobs, ...themes.pains, ...themes.gains][0]!
  await expect(page.getByRole('main').getByText(first.name, { exact: true }).first()).toBeVisible()
  expect(asked).toEqual([])
})

test('switching the language on the demo report renames the themes, still without a request', async ({ page }) => {
  const asked = await noAi(page)
  const german = await expected('de')
  await page.goto('/')
  await openDemo(page)
  await expect(note(page)).toBeVisible()
  await page.getByRole('button', { name: 'German' }).click()
  await expect(page).toHaveURL(/\/de\/report\/$/)
  const first = [...german.jobs, ...german.pains, ...german.gains][0]!
  await expect(page.getByRole('main').getByText(first.name, { exact: true }).first()).toBeVisible()
  expect(asked).toEqual([])
})

test('on Analyze, the sample offers the demo; it opens the report, and leaving it returns to a normal analysis', async ({ page }) => {
  const asked = await noAi(page)
  await page.goto('/')
  await openSample(page)
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

  test('"Try an example" opens the bigger-screen sheet, like the other start action', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try an example' }).tap()
    await expect(page.getByRole('dialog', { name: 'Painfold likes a bigger screen' })).toBeVisible()
  })
})
