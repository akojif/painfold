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
