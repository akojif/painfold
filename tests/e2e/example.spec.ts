import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const cleaned = (page: Page) => page.locator('figure[data-cleaned]').waitFor({ timeout: 5000 })
const phone = (page: Page) => page.getByRole('figure').getByRole('button', { name: '[PHONE_1]' })

test('the example follows the interface language', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('figure')).toContainText('Please call me back on')
  await expect(page.getByText('Works with German and English feedback')).toBeVisible()
  await page.goto('/de')
  await expect(page.getByRole('figure')).toContainText('Bitte rufen Sie mich unter')
  await expect(page.getByText('Funktioniert mit deutschem und englischem Feedback')).toBeVisible()
})

test('hovering a placeholder shows what it replaced and replays the redaction', async ({ page }) => {
  await page.goto('/')
  await cleaned(page)
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toBeHidden()
  await phone(page).hover()
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toHaveText('Phone number removed:+44 20 7946 0958')
  await expect(phone(page).locator('.animate-token-wipe')).toBeAttached()
  await page.mouse.move(0, 0)
  await expect(tooltip).toBeHidden()
})

test('keyboard focus shows it, screen readers hear it, Escape closes it', async ({ page }) => {
  await page.goto('/')
  await cleaned(page)
  await phone(page).focus()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await expect(phone(page)).toHaveAccessibleDescription('Phone number removed: +44 20 7946 0958')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toBeHidden()
})

test('the German page explains in German', async ({ page }) => {
  await page.goto('/de')
  await cleaned(page)
  await phone(page).focus()
  await expect(page.getByRole('tooltip')).toHaveText('Telefonnummer entfernt:+49 30 23125 417')
})

test.describe('on a touch screen at 390px', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('a tap toggles the tooltip, a tap elsewhere closes it, and it stays on screen', async ({ page }) => {
    await page.goto('/')
    await cleaned(page)
    const tooltip = page.getByRole('tooltip')
    const email = page.getByRole('figure').getByRole('button', { name: '[EMAIL_1]' })
    await email.tap()
    await expect(tooltip).toBeVisible()
    const box = (await tooltip.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    await email.tap()
    await expect(tooltip).toBeHidden()
    await email.tap()
    await expect(tooltip).toBeVisible()
    await page.getByRole('heading', { level: 1 }).tap()
    await expect(tooltip).toBeHidden()
  })
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the tooltip and the placeholder do not animate', async ({ page }) => {
    await page.goto('/')
    await cleaned(page)
    await phone(page).hover()
    await expect(page.getByRole('tooltip')).toHaveCSS('animation-name', 'none')
    await expect(phone(page).locator('span').first()).toHaveCSS('animation-name', 'none')
  })
})
