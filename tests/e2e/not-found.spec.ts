import { expect, test } from './fixtures'

test('a missing address gets a 404 status and the not-found page', async ({ page }) => {
  const response = await page.goto('/no-such-page')
  expect(response!.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nothing to clean here.')
  await expect(page.getByText(/^The address \/no-such-page\/? was not found\.$/)).toBeAttached()
  // The address is shown waiting, then replaced by its placeholder, like personal data in the review.
  await expect(page.getByText('[PAGE_404]')).toBeVisible()
  await expect(page.locator('footer')).toContainText('Your file is never uploaded.')
  // The error page renders outside app.vue, so check it still gets the page colours.
  await expect(page.locator('body')).toHaveClass(/bg-canvas/)
  await page.getByRole('link', { name: 'Back to the start' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find what hurts your customers. Without exposing who they are.')
})

test('a missing German address shows the not-found page in German', async ({ page }) => {
  const response = await page.goto('/de/gibt-es-nicht')
  expect(response!.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hier gibt es nichts zu bereinigen.')
  await page.getByRole('link', { name: 'Zurück zum Start' }).click()
  await expect(page).toHaveURL(/\/de\/$/)
})

test('the roadmap link leaves the not-found page', async ({ page }) => {
  await page.goto('/no-such-page')
  await page.getByRole('link', { name: 'See the roadmap' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap')
})

test('a malformed address still shows the not-found page', async ({ page }) => {
  await page.goto('/%E0%A4')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nothing to clean here.')
  await expect(page.getByText('[PAGE_404]')).toBeVisible()
})

test('there is no single-page fallback that answers every address with 200', async ({ request }) => {
  expect((await request.get('/200.html')).status()).toBe(404)
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the placeholder is there at once, without animation', async ({ page }) => {
    await page.goto('/no-such-page')
    const token = page.getByText('[PAGE_404]')
    await expect(token).toBeVisible({ timeout: 500 })
    await expect(token).toHaveCSS('animation-name', 'none')
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 320, height: 700 } })

  test('a long missing address does not scroll sideways', async ({ page }) => {
    await page.goto('/a-very-long-address/that-nobody-should-ever-type/into-the-browser/really-not')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
})
