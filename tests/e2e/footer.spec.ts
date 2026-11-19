import type { Locator, Page } from '@playwright/test'
import { expect, openSample, test } from './fixtures'

// One footer on every page (#147): links only. On desktop one line in the
// header's grid, the links on the left and the credit on the right; below
// 768 px two short centred lines, the links and then the credit. The privacy
// notice is on the start page, Review and Analyze, not here.

const footer = (page: Page) => page.locator('footer')
const box = async (locator: Locator) => (await locator.boundingBox())!
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const LINE = 24 // one line of 13 px text, with room for the icon

test('every page has the same footer, links only: Roadmap, Accuracy, the GitHub mark, llms.txt and the credit', async ({ page }) => {
  const texts: string[] = []
  for (const path of ['/', '/roadmap/', '/accuracy/', '/no-such-page/']) {
    await page.goto(path)
    texts.push(await footer(page).innerText())
  }
  await page.goto('/')
  await openSample(page)
  await page.getByRole('button', { name: /^Find personal data in/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
  texts.push(await footer(page).innerText())
  await page.getByRole('link', { name: 'Continue to analyze' }).last().click()
  texts.push(await footer(page).innerText())

  expect(new Set(texts).size).toBe(1)
  expect(texts[0]).not.toMatch(/browser|uploaded/)
  await expect(footer(page).getByRole('navigation', { name: 'Footer' }).getByRole('link')).toHaveText(['Roadmap', 'Accuracy', 'Open source', 'llms.txt'])
  const source = footer(page).getByRole('link', { name: 'Open source' })
  await expect(source).toHaveAttribute('href', 'https://github.com/akojif/painfold')
  // The GitHub mark is the link; its label is for screen readers.
  await expect(source.locator('svg')).toBeVisible()
  // No teal dots, and no separate cookie or account items.
  await expect(footer(page).locator('.rounded-full')).toHaveCount(0)
  await expect(footer(page)).not.toContainText(/cookies|account/i)
})

for (const width of [1280, 768]) {
  test(`at ${width} px the footer is one line, as tall as the header, in the header's grid`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/roadmap/')
    const row = footer(page).locator(':scope > div')
    const header = page.locator('header > div')
    expect((await box(row)).height).toBe((await box(header)).height)
    expect((await box(row)).x).toBe((await box(header)).x)
    expect((await box(row)).width).toBe((await box(header)).width)
    const parts = [footer(page).getByRole('navigation'), footer(page).getByText(/^Built by/)]
    // The links start at the grid's left edge; the credit ends at its right edge.
    expect(Math.round((await box(parts[0]!)).x)).toBe(Math.round((await box(row)).x + 24))
    expect(Math.round((await box(parts[1]!)).x + (await box(parts[1]!)).width)).toBe(Math.round((await box(row)).x + (await box(row)).width - 24))
    const centres = await Promise.all(parts.map(async part => (await box(part)).y + (await box(part)).height / 2))
    for (const centre of centres) expect(Math.abs(centre - centres[0]!)).toBeLessThan(2)
    for (const part of parts) expect((await box(part)).height).toBeLessThan(LINE)
  })
}

for (const width of [390, 320]) {
  for (const [path, credit, links] of [['/', /^Built by/, ['Roadmap', 'Accuracy', 'Open source', 'llms.txt']], ['/de/', /^Entwickelt von/, ['Roadmap', 'Genauigkeit', 'Open Source', 'llms.txt']]] as const) {
    test(`on a phone, ${width} px, ${path === '/' ? 'English' : 'German'}: two short centred lines, the links and the credit`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(path)
      const nav = footer(page).getByRole('navigation')
      const built = footer(page).getByText(credit)
      await expect(nav.getByRole('link')).toHaveText([...links])
      const navBox = await box(nav)
      const builtBox = await box(built)
      expect(navBox.height).toBeLessThan(LINE)
      expect(builtBox.height).toBeLessThan(LINE)
      expect(builtBox.y).toBeGreaterThan(navBox.y)
      for (const part of [navBox, builtBox]) expect(Math.abs(part.x + part.width / 2 - width / 2)).toBeLessThan(2)
      expect(await sideways(page)).toBeLessThanOrEqual(0)
    })
  }
}
