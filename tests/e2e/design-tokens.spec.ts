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

  expect(loaded).toContain('Atkinson Hyperlegible Next')
  expect(fontRequests.length).toBeGreaterThan(0)
  // The foreign-request fixture already fails on other origins; this states the intent.
  for (const url of fontRequests) expect(url).toMatch(/\.woff2$/)
})

for (const [scheme, desk, ink] of [
  ['light', 'rgb(238, 241, 244)', 'rgb(27, 36, 51)'],
  ['dark', 'rgb(17, 22, 31)', 'rgb(227, 232, 238)'],
] as const) {
  test(`the ${scheme} theme applies the desk and ink colours`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    const body = page.locator('body')
    await expect(body).toHaveCSS('background-color', desk)
    await expect(body).toHaveCSS('color', ink)
  })
}
