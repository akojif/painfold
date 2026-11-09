import { expect, test } from './fixtures'

test('the interface font is self-hosted and loads', async ({ page }) => {
  const fontRequests: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fontRequests.push(request.url())
  })

  await page.goto('/')
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replaceAll('"', ''))
  })

  expect(loaded).toContain('Geist')
  expect(fontRequests.length).toBeGreaterThan(0)
  // The foreign-request fixture already fails on other origins; this states the intent.
  for (const url of fontRequests) expect(url).toMatch(/\.woff2$/)
})

for (const [scheme, canvas, fg] of [
  ['light', 'rgb(255, 255, 255)', 'rgb(17, 24, 39)'],
  ['dark', 'rgb(17, 22, 31)', 'rgb(230, 234, 240)'],
] as const) {
  test(`the ${scheme} system theme applies its page and text colours`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    const body = page.locator('body')
    await expect(body).toHaveCSS('background-color', canvas)
    await expect(body).toHaveCSS('color', fg)
  })
}

test('the theme toggle overrides the system and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Dark' }).click()
  const body = page.locator('body')
  await expect(body).toHaveCSS('background-color', 'rgb(17, 22, 31)')
  await page.reload()
  await expect(body).toHaveCSS('background-color', 'rgb(17, 22, 31)')
  await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'System' }).click()
  await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
})
