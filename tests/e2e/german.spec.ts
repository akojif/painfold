import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test('German pages are prerendered under /de/ with the right language', async ({ request }) => {
  const html = await (await request.get('/de')).text()
  expect(html).toContain('lang="de-AT"')
  expect(html).toContain('Finden Sie, was Ihren Kunden wehtut.')
  expect(html).toMatch(/<link[^>]*rel="alternate"[^>]*href="https:\/\/painfold\.vercel\.app"[^>]*hreflang="en"/)
  expect(await (await request.get('/de/roadmap')).text()).toContain('Der erste Schritt: Ihr Feedback vertraulich bereinigen.')
})

test('switching language keeps the open file and every review decision', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the sample file' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose what to check')

  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'German' }).click()
  await expect(page).toHaveURL(/\/de$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wählen Sie, was geprüft wird')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-AT')

  await page.getByRole('button', { name: /Personenbezogene Daten in 200 Zeilen finden/ }).click()
  await expect(page).toHaveURL(/\/de\/review$/)
  await page.keyboard.press('r')
  // The same counts before and after the switch: the decision survived it.
  const counts = async (pattern: RegExp) => (await page.getByText(pattern).innerText()).match(/[\d.,]+/g)!.map(n => n.replace(/[.,]/g, ''))
  const before = await counts(/geprüft, .* offen/)
  expect(Number(before[0])).toBeGreaterThan(0)

  await page.getByRole('group', { name: 'Sprache' }).getByRole('button', { name: 'Englisch' }).click()
  await expect(page).toHaveURL(/\/review$/)
  expect(await counts(/reviewed, .* left/)).toEqual(before)
  await expect(page.getByRole('tab', { name: 'By value' })).toBeVisible()
})

test('the cleaning report follows the interface language', async ({ page }) => {
  await page.goto('/de')
  await page.getByRole('button', { name: 'Beispieldatei ausprobieren' }).click()
  await page.getByRole('button', { name: /Personenbezogene Daten in 200 Zeilen finden/ }).click()
  await page.getByRole('link', { name: 'Weiter zum Download' }).last().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ihre bereinigte Datei ist fertig.')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Bereinigungsbericht herunterladen (.txt)' }).click()])
  const report = readFileSync((await download.path())!, 'utf8')
  expect(report).toContain('Painfold-Bereinigungsbericht')
  expect(report).toContain('Die automatische Erkennung kann personenbezogene Daten übersehen.')
})

test('only the language choice is stored, in localStorage, besides the theme', async ({ page, context }) => {
  await page.goto('/')
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'German' }).click()
  await expect(page).toHaveURL(/\/de$/)
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({ 'painfold-language': 'de' })
  expect(await context.cookies()).toEqual([])
})

test.describe('choosing the language at the root', () => {
  test.describe('with a German browser', () => {
    test.use({ locale: 'de-AT' })

    test('the root opens the German start page', async ({ page }) => {
      await page.goto('/')
      await expect(page).toHaveURL(/\/de$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Finden Sie, was Ihren Kunden wehtut. Ohne preiszugeben, wer sie sind.')
    })

    test('a saved English choice wins over the browser language', async ({ page }) => {
      await page.goto('/roadmap')
      await page.evaluate(() => localStorage.setItem('painfold-language', 'en'))
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find what hurts your customers. Without exposing who they are.')
    })
  })

  test('a shared German link stays German, even after choosing English', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('painfold-language', 'en'))
    await page.goto('/de/roadmap')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap')
    await expect(page.getByText('Aktuelle Phase')).toBeVisible()
  })

  test('a saved German choice opens German at the root', async ({ page }) => {
    await page.goto('/roadmap')
    await page.evaluate(() => localStorage.setItem('painfold-language', 'de'))
    await page.goto('/')
    await expect(page).toHaveURL(/\/de$/)
  })
})

test.describe('German at 320px', () => {
  test.use({ viewport: { width: 320, height: 800 } })

  test('long German words do not make any screen scroll sideways', async ({ page }) => {
    await page.goto('/de')
    expect(await sideways(page), 'start').toBeLessThanOrEqual(0)
    await page.getByRole('button', { name: 'Beispieldatei ausprobieren' }).click()
    // On a phone the flow runs after "Trotzdem weiter" (tests/e2e/mobile.spec.ts).
    expect(await sideways(page), 'sheet').toBeLessThanOrEqual(0)
    await page.getByRole('button', { name: 'Trotzdem weiter' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wählen Sie, was geprüft wird')
    expect(await sideways(page), 'columns').toBeLessThanOrEqual(0)
    await page.getByRole('button', { name: /Personenbezogene Daten in 200 Zeilen finden/ }).click()
    await expect(page).toHaveURL(/\/de\/review$/)
    expect(await sideways(page), 'review by value').toBeLessThanOrEqual(0)
    await page.getByRole('tab', { name: 'Nach Zeile' }).click()
    expect(await sideways(page), 'review by row').toBeLessThanOrEqual(0)
    await page.getByRole('link', { name: 'Weiter zum Download' }).last().click()
    expect(await sideways(page), 'download').toBeLessThanOrEqual(0)
    await page.goto('/de/roadmap')
    expect(await sideways(page), 'roadmap').toBeLessThanOrEqual(0)
  })
})
