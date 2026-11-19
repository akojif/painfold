import { expect, openSample, test } from './fixtures'

// The workspace shell (#141): the top bar with the four steps on every step of
// the working flow once a file is open, and the footer below.

test('the top bar shows the steps as links once they can be reached, with what each holds', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Steps' })).toHaveCount(0)
  await openSample(page)
  const steps = page.getByRole('navigation', { name: 'Steps' })
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/Import/)
  // Nothing reviewed yet: only Import is there, and it is the current step, not a link.
  await expect(steps.getByRole('link')).toHaveCount(0)

  await page.getByRole('button', { name: /Find personal data/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/findings in 200 rows/)
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/^\s*Review,\s*\d+ left$/)
  await expect(steps.getByRole('link')).toHaveText(['Import, done', 'Analyze'])
  await expect(page.locator('header').getByRole('button', { name: 'Start over' })).toBeVisible()
  await expect(page.locator('footer').getByRole('link', { name: 'Roadmap' })).toBeVisible()

  // Back to the column step from the steps, with the review kept.
  await steps.getByRole('link', { name: /Import/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/Import/)

  // Steps reached from the top bar show at once, never the empty page a direct visit gets first (#172).
  await steps.getByRole('link', { name: /Review/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/findings in 200 rows/)
  await steps.getByRole('link', { name: /Analyze/ }).click()
  await expect(page).toHaveURL(/\/analyze\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Where should the analysis run?')
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/Analyze/)
})

test('the steps read in German', async ({ page }) => {
  await page.goto('/de/')
  await openSample(page)
  await page.getByRole('button', { name: /^Personenbezogene Daten in .+ finden$/ }).click()
  const steps = page.getByRole('navigation', { name: 'Schritte' })
  await expect(steps.getByRole('listitem')).toHaveText([/Importieren/, /Prüfen/, /Analysieren/, /Bericht/])
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/^\s*Prüfen,\s*\d+ offen$/)
  await expect(page.locator('header').getByRole('button', { name: 'Neu beginnen' })).toBeVisible()
})

test('Import: the sidebar holds the file and where the rules found personal data', async ({ page }) => {
  await page.goto('/')
  await openSample(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose what to check')
  const sidebar = page.getByRole('complementary', { name: 'File and columns' })
  await expect(sidebar.getByRole('heading', { level: 2 })).toHaveText(['File', 'Personal data by column'])
  await expect(sidebar.getByTitle('support-tickets.csv', { exact: true })).toBeVisible()
  await expect(sidebar.locator('dl > div')).toHaveText([/^Rows\s*200$/, /^Columns\s*9$/])
  await expect(sidebar.getByText('Sample file with fake data.')).toBeVisible()
  // Most personal data first, with what happens to the column when it is not checked.
  const columns = sidebar.getByRole('listitem')
  await expect(columns.first()).toHaveText(/^customer_email\s*Drop\s*200$/)
  await expect(columns.filter({ hasText: 'message' })).toHaveText(/^message\s*\d+$/)
  await expect(page.getByRole('button', { name: 'Find personal data in 200 rows' })).toBeVisible()
})

test.describe('Import at 768 px', () => {
  test.use({ viewport: { width: 768, height: 900 } })

  test('the sidebar comes first, and nothing scrolls sideways, in English and German', async ({ page }) => {
    for (const [path, sidebarName] of [['/', 'File and columns'], ['/de/', 'Datei und Spalten']] as const) {
      await page.goto(path)
      await openSample(page)
      const sidebar = page.getByRole('complementary', { name: sidebarName })
      const top = async (locator: import('@playwright/test').Locator) => (await locator.boundingBox())!.y
      expect(await top(sidebar)).toBeLessThan(await top(page.getByRole('heading', { level: 1 })))
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0)
      await page.locator('header').getByRole('button', { name: /^(Start over|Neu beginnen)$/ }).click()
      const dialog = page.getByRole('dialog')
      if (await dialog.isVisible().catch(() => false)) await dialog.getByRole('button', { name: /^(Start over|Neu beginnen)$/ }).click()
    }
  })
})
