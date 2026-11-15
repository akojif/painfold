import type { Page } from '@playwright/test'
import { expect, openSample, test } from './fixtures'

// Painfold needs a screen at least 768 px wide (#139). Below that, phones see
// what it does: the start page and the other informational pages read fine,
// both start actions open a sheet with Copy link and Close, a dropped file is
// ignored, and working routes show a notice instead. Widening the window
// turns the flow on without a reload; narrowing it mid-flow keeps the file.

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Painfold likes a bigger screen' })
const choose = (page: Page) => page.getByRole('button', { name: 'Choose a CSV or Excel file' })
const sample = (page: Page) => page.getByRole('button', { name: 'Try an example' })
const heading = (page: Page) => page.getByRole('heading', { level: 1 })
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const BODY = 'Reviewing hundreds of rows is a job for a laptop. Open Painfold on your computer: your file stays just as private there.'
const START = 'Find what hurts your customers. Without exposing who they are.'

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
      await expect(footer.getByRole('link', { name: 'Roadmap' })).toBeVisible()
      await expect(footer.getByRole('link', { name: 'Accuracy' })).toBeVisible()
      expect(await sideways(page)).toBeLessThanOrEqual(0)
    })

    test('both actions open the sheet, with Copy link and Close and no way on; it is focused, closes, and fits', async ({ page }) => {
      await page.goto('/')
      for (const action of [choose, sample]) {
        await action(page).tap()
        await expect(sheet(page)).toBeVisible()
        await expect(sheet(page)).toContainText(BODY)
        await expect(sheet(page).getByRole('button')).toHaveText(['Copy link', 'Close'])
        await expect(sheet(page).getByRole('button', { name: 'Copy link' })).toBeFocused()
        expect(await sideways(page)).toBeLessThanOrEqual(0)
        await sheet(page).getByRole('button', { name: 'Close' }).tap()
        await expect(sheet(page)).toBeHidden()
        await expect(heading(page)).toHaveText(START)
      }
      await sample(page).tap()
      await page.keyboard.press('Escape')
      await expect(sheet(page)).toBeHidden()
    })

    test('the informational pages never scroll sideways', async ({ page }) => {
      for (const path of ['/', '/roadmap/', '/accuracy/', '/no-such-page/', '/de/', '/de/roadmap/', '/de/accuracy/']) {
        await page.goto(path)
        expect(await sideways(page), path).toBeLessThanOrEqual(0)
      }
    })

    test('direct links to the working routes show the message, with Copy link and the way to the start page', async ({ page }) => {
      for (const path of ['/review/', '/download/', '/analyze/', '/report/']) {
        await page.goto(path)
        await expect(page, path).toHaveURL(new RegExp(`${path}$`))
        await expect(heading(page), path).toHaveText('Painfold likes a bigger screen')
        await expect(page.getByRole('main')).toContainText(BODY)
        await expect(page.getByRole('main').getByRole('button', { name: 'Copy link' })).toBeVisible()
        expect(await sideways(page), path).toBeLessThanOrEqual(0)
      }
      await page.getByRole('link', { name: 'Go to the start page' }).tap()
      await expect(heading(page)).toHaveText(START)
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
    await page.goto('/review/')
    await page.getByRole('main').getByRole('button', { name: 'Copy link' }).tap()
    await expect(page.getByRole('main')).toContainText(`${baseURL}/`)
  })

  test('a dropped file is ignored: no drop state, nothing opens', async ({ page }) => {
    await page.goto('/')
    await page.locator('main').evaluate((target) => {
      const data = new DataTransfer()
      data.items.add(new File(['feedback\nThe export is slow\n'], 'feedback.csv', { type: 'text/csv' }))
      target.dispatchEvent(new DragEvent('dragenter', { dataTransfer: data, bubbles: true, cancelable: true }))
      target.dispatchEvent(new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }))
    })
    await expect(page.getByText('Drop to open')).toBeHidden()
    await page.locator('main').evaluate((target) => {
      const data = new DataTransfer()
      data.items.add(new File(['feedback\nThe export is slow\n'], 'feedback.csv', { type: 'text/csv' }))
      target.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }))
    })
    await expect(heading(page)).toHaveText(START)
    await expect(page.getByRole('button', { name: 'Start over' })).toHaveCount(0)
  })

  test('the German sheet and notice read in German', async ({ page }) => {
    await page.goto('/de/')
    await page.getByRole('button', { name: 'Beispiel ausprobieren' }).tap()
    const german = page.getByRole('dialog', { name: 'Painfold mag größere Bildschirme' })
    await expect(german).toContainText('Öffnen Sie Painfold auf Ihrem Computer')
    await expect(german.getByRole('button')).toHaveText(['Link kopieren', 'Schließen'])
    await page.goto('/de/review/')
    await expect(heading(page)).toHaveText('Painfold mag größere Bildschirme')
    await expect(page.getByRole('link', { name: 'Zur Startseite' })).toBeVisible()
  })
})

test('narrowing the window mid-flow keeps the file and the review; widening brings them back without a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await openSample(page)
  await expect(heading(page)).toHaveText('Choose what to check')
  await page.evaluate(() => ((window as unknown as { notReloaded: boolean }).notReloaded = true))

  await page.setViewportSize({ width: 390, height: 900 })
  await expect(heading(page)).toHaveText('Your file is still open')
  await expect(page.getByRole('main')).toContainText('Make this window at least 768 pixels wide to carry on. Nothing has been lost.')
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(heading(page)).toHaveText('Choose what to check')

  await page.getByRole('button', { name: /^Find personal data in/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
  const reviewed = page.getByRole('heading', { level: 1 })
  const before = await reviewed.textContent()
  await page.setViewportSize({ width: 767, height: 900 })
  await expect(heading(page)).toHaveText('Your file is still open')
  await page.setViewportSize({ width: 768, height: 900 })
  await expect(reviewed).toHaveText(before!)
  expect(await page.evaluate(() => (window as unknown as { notReloaded?: boolean }).notReloaded)).toBe(true)
})

test('widening on a direct link with no file open leads to where a larger screen would be', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/review/')
  await expect(heading(page)).toHaveText('Painfold likes a bigger screen')
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(heading(page)).toHaveText(START)

  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/report/')
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(heading(page)).toHaveText(START)
})

for (const width of [1280, 768]) {
  test(`a larger screen (${width} px) never sees the sheet or the notice`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await openSample(page)
    await expect(heading(page)).toHaveText('Choose what to check')
    await expect(sheet(page)).toHaveCount(0)
    await expect(page.getByText('Your file is still open')).toBeHidden()
    await expect(page.getByRole('button', { name: /^Download name model/ })).toBeVisible()
  })
}
