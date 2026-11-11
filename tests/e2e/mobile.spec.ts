import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Below 768 px the start screen explains Painfold, and its actions first
// suggest a bigger screen (#60). Nobody is blocked: Continue anyway runs the
// flow on the phone. Larger screens never see the sheet.

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Painfold likes a bigger screen' })
const choose = (page: Page) => page.getByRole('button', { name: 'Choose a CSV or Excel file' })
const sample = (page: Page) => page.getByRole('button', { name: 'Try the sample file' })
const columns = (page: Page) => expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose what to check')
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

for (const width of [390, 320]) {
  test.describe(`on a phone, ${width} px wide`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })

    test('the start screen reads in order: headline, actions, example, then the trust row with the roadmap and accuracy pages; no journey list', async ({ page }) => {
      await page.goto('/')
      const y = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!.y
      const actions = await y(choose(page))
      const example = await y(page.getByRole('figure'))
      expect(actions).toBeLessThan(example)
      await expect(page.getByRole('list', { name: 'What Painfold does' })).toBeHidden()
      const footer = page.locator('footer')
      expect(example).toBeLessThan(await y(footer))
      await expect(footer.getByRole('listitem').filter({ hasText: 'No cookies' })).toBeVisible()
      await expect(footer.getByRole('link', { name: 'Roadmap' })).toBeVisible()
      await expect(footer.getByRole('link', { name: 'Accuracy' })).toBeVisible()
      expect(await sideways(page)).toBeLessThanOrEqual(0)
    })

    test('both actions show the sheet first; it is kind, focused, closes with Escape, and fits', async ({ page }) => {
      await page.goto('/')
      for (const action of [choose, sample]) {
        await action(page).tap()
        await expect(sheet(page)).toBeVisible()
        await expect(sheet(page)).toContainText('This phone shows it off nicely, but reviewing hundreds of rows is a job for a laptop. Your thumbs will thank you. Open it on your computer: your file stays just as private there.')
        await expect(sheet(page).getByRole('button', { name: 'Copy link' })).toBeFocused()
        expect(await sideways(page)).toBeLessThanOrEqual(0)
        await page.keyboard.press('Escape')
        await expect(sheet(page)).toBeHidden()
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find what hurts your customers. Without exposing who they are.')
      }
    })
  })
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true })

  test('Copy link puts the start page\'s address on the clipboard and says so', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')
    await choose(page).tap()
    await sheet(page).getByRole('button', { name: 'Copy link' }).tap()
    await expect(sheet(page).getByRole('button', { name: 'Link copied' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}/`)
  })

  test('where copying is not allowed, the address is shown to copy by hand', async ({ page, baseURL }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } }))
    await page.goto('/')
    await choose(page).tap()
    await sheet(page).getByRole('button', { name: 'Copy link' }).tap()
    await expect(sheet(page)).toContainText(`${baseURL}/`)
  })

  test('Continue anyway runs the action that was tapped, and the rest of the visit goes straight through', async ({ page }) => {
    await page.goto('/')
    await sample(page).tap()
    await sheet(page).getByRole('button', { name: 'Continue anyway' }).tap()
    await columns(page)

    await page.getByRole('button', { name: 'Start over' }).tap()
    const chooser = page.waitForEvent('filechooser')
    await choose(page).tap()
    await chooser
    await expect(sheet(page)).toBeHidden()
  })

  test('the name model is never offered on a phone; the review and the download say names are checked on a larger screen', async ({ page }) => {
    await page.goto('/')
    await sample(page).tap()
    await sheet(page).getByRole('button', { name: 'Continue anyway' }).tap()
    await columns(page)
    await expect(page.getByText('Names are checked on a larger screen. Everything else works here.')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Download name model/ })).toHaveCount(0)

    await page.getByRole('button', { name: /^Find personal data in/ }).tap()
    await expect(page.getByText('Names are checked on a larger screen. Everything else works here.')).toBeVisible()
    await page.getByRole('link', { name: 'Continue to download' }).last().tap()
    await expect(page.getByText('Names were not checked: that happens on a larger screen.')).toBeVisible()
    expect(await sideways(page)).toBeLessThanOrEqual(0)
  })

  test('the German sheet reads in German', async ({ page }) => {
    await page.goto('/de/')
    await page.getByRole('button', { name: 'Beispieldatei ausprobieren' }).tap()
    const german = page.getByRole('dialog', { name: 'Painfold mag größere Bildschirme' })
    await expect(german).toContainText('Ihre Daumen werden es Ihnen danken.')
    await expect(german.getByRole('button', { name: 'Link kopieren' })).toBeVisible()
    await expect(german.getByRole('button', { name: 'Trotzdem weiter' })).toBeVisible()
  })
})

for (const width of [1280, 768]) {
  test(`a larger screen (${width} px) never sees the sheet`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await sample(page).click()
    await columns(page)
    await expect(sheet(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Download name model/ })).toBeVisible()
  })
}
