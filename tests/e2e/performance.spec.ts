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
