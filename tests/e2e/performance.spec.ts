import { readFileSync } from 'node:fs'
import { buildSample } from '../../scripts/generate-fake-data'
import { expect, test } from './fixtures'

// Stage 1 is done when a 5,000-row file is cleaned in under 10 seconds on a
// normal laptop: import, column step, detection, review and export, clicked
// straight through. Shared CI runners are slower, so CI gets twice the time;
// the number in docs/accuracy.md comes from `npm run bench` on a laptop.
const ROWS = 5000
const BUDGET = process.env.CI ? 20_000 : 10_000

test('a 5,000-row file is cleaned within the time budget', async ({ page }) => {
  test.setTimeout(60_000)
  const csv = Buffer.from(buildSample(4711, ROWS))
  await page.goto('/')

  const started = Date.now()
  await page.getByTestId('file-input').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: csv })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose what to check')
  const imported = Date.now()

  await page.getByRole('button', { name: `Find personal data in ${ROWS.toLocaleString('en')} rows` }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/findings in 5,000 rows/, { timeout: 30_000 })
  const reviewed = Date.now()

  await page.getByRole('link', { name: 'Continue to download' }).last().click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download large_cleaned/ }).click()])
  const cleaned = readFileSync((await download.path())!, 'utf8')
  const finished = Date.now()

  // Header plus one line per row; cells can hold line breaks, so count records loosely.
  expect(cleaned.split('\r\n').filter(Boolean).length).toBeGreaterThanOrEqual(ROWS + 1)
  const timings = { import: imported - started, detectAndReview: reviewed - imported, export: finished - reviewed, total: finished - started }
  test.info().annotations.push({ type: 'timings (ms)', description: JSON.stringify(timings) })
  if (process.env.BENCH) process.stdout.write(`\n5,000 rows: ${JSON.stringify(timings)} ms\n`)
  expect(timings.total).toBeLessThan(BUDGET)
})

// Stage 2: names in 5,000 rows are checked in under 2.5 minutes on a recent
// laptop, with the model already in the browser. Only with `npm run bench`:
// shared CI runners are too slow and uneven for this number to mean anything.
test('names in a 5,000-row file are checked within the time budget, model cached', async ({ page }) => {
  test.skip(!process.env.BENCH, 'run with npm run bench')
  test.setTimeout(300_000)
  const csv = Buffer.from(buildSample(4711, ROWS))
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: csv })
  await page.getByRole('button', { name: /^Download name model/ }).click()
  await expect(page.getByText(/^Name model stored in this browser/)).toBeVisible({ timeout: 120_000 })

  const started = Date.now()
  await page.getByRole('button', { name: `Find personal data in ${ROWS.toLocaleString('en')} rows` }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/findings in 5,000 rows/, { timeout: 30_000 })
  const rules = Date.now()
  await expect(page.getByText('Names and places checked.', { exact: true })).toBeVisible({ timeout: 280_000 })
  const finished = Date.now()

  const timings = { rules: rules - started, names: finished - rules, total: finished - started }
  process.stdout.write(`\n5,000 rows with names: ${JSON.stringify(timings)} ms, ${await page.getByText('Names and places checked.', { exact: true }).innerText()}\n`)
  expect(timings.total).toBeLessThan(150_000)
})
