import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Starting over and leaving the flow: ask first whenever work would be lost
// (a review, or changed column choices, not downloaded since), never when
// nothing would be.

const sample = async (page: Page, path = '/') => {
  await page.goto(path)
  await page.getByRole('button', { name: path === '/' ? 'Try the sample file' : 'Beispieldatei ausprobieren' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(path === '/' ? 'Choose what to check' : 'Wählen Sie, was geprüft wird')
}
const review = async (page: Page) => {
  await sample(page)
  await page.getByRole('button', { name: /^Find personal data in/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/findings in 200 rows$/)
}
// The role control's radios are visually hidden behind their labels; click the label.
const dropChannel = (page: Page, drop = 'Drop') => page.getByRole('group', { name: /channel/ }).locator('label').filter({ hasText: drop }).click()
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Start over?' })
const startScreen = (page: Page) => expect(page.getByRole('heading', { level: 1 })).toHaveText('Find what hurts your customers. Without exposing who they are.')

test.describe('nothing to lose: no question', () => {
  test('Start over right after opening a file goes straight to the start', async ({ page }) => {
    await sample(page)
    await page.getByRole('button', { name: 'Start over' }).click()
    await startScreen(page)
    await expect(dialog(page)).toBeHidden()
  })

  test('Choose another file right after opening one opens the file picker', async ({ page }) => {
    await sample(page)
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Choose another file' }).click()
    await chooser
    await expect(dialog(page)).toBeHidden()
  })

  test('after the cleaned file is downloaded, starting over does not ask, and leaving does not warn', async ({ page }) => {
    await review(page)
    await page.getByRole('link', { name: 'Continue to download' }).last().click()
    await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download support-tickets_cleaned/ }).click()])
    let warned = false
    page.on('dialog', async (shown) => {
      warned = true
      await shown.dismiss()
    })
    await page.getByRole('button', { name: 'Start over' }).click()
    await startScreen(page)
    await page.close({ runBeforeUnload: true })
    expect(warned).toBe(false)
  })
})

test.describe('work to lose: ask first', () => {
  test('Start over asks; Keep working has focus, keeps the dialog focused, and Escape means Keep working', async ({ page }) => {
    await review(page)
    await page.getByRole('button', { name: 'Start over' }).click()
    await expect(dialog(page)).toContainText('Your file and your review decisions will be cleared. Nothing was uploaded, so nothing is kept anywhere else.')
    const keep = dialog(page).getByRole('button', { name: 'Keep working' })
    await expect(keep).toBeFocused()
    // Focus stays inside the dialog.
    await page.keyboard.press('Tab')
    await expect(dialog(page).getByRole('button', { name: 'Start over' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(keep).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/findings in 200 rows$/)

    await page.getByRole('button', { name: 'Start over' }).click()
    await keep.click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/findings in 200 rows$/)

    await page.getByRole('button', { name: 'Start over' }).click()
    await dialog(page).getByRole('button', { name: 'Start over' }).click()
    await startScreen(page)
  })

  test('the logo asks before leaving a review', async ({ page }) => {
    await review(page)
    await page.getByRole('link', { name: 'Painfold' }).click()
    await expect(dialog(page)).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Keep working' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/findings in 200 rows$/)
    await page.getByRole('link', { name: 'Painfold' }).click()
    await dialog(page).getByRole('button', { name: 'Start over' }).click()
    await startScreen(page)
  })

  test('Choose another file asks once column choices were changed', async ({ page }) => {
    await sample(page)
    await dropChannel(page)
    await page.getByRole('button', { name: 'Choose another file' }).click()
    await expect(dialog(page)).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Keep working' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose what to check')
  })

  test('the download step asks before starting over when nothing was downloaded', async ({ page }) => {
    await review(page)
    await page.getByRole('link', { name: 'Continue to download' }).last().click()
    await page.getByRole('button', { name: 'Start over' }).click()
    await expect(dialog(page)).toBeVisible()
  })

  test('closing or reloading the tab mid-review triggers the browser\'s own warning', async ({ page }) => {
    await review(page)
    const warning = page.waitForEvent('dialog')
    await page.close({ runBeforeUnload: true })
    expect((await warning).type()).toBe('beforeunload')
  })
})

test.describe('back to the column step', () => {
  test('keeps the file and the review: Continue to review returns with every decision', async ({ page }) => {
    await review(page)
    await page.locator('[data-value]').first().focus()
    await page.keyboard.press('k')
    await expect(page.getByText(/^1 reviewed, \d+ left$/)).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose what to check')
    await page.getByRole('button', { name: 'Continue to review' }).click()
    await expect(page.getByText(/^1 reviewed, \d+ left$/)).toBeVisible()
  })

  test('changed columns say the review will be reset, and ask before resetting decisions', async ({ page }) => {
    await review(page)
    await page.locator('[data-value]').first().focus()
    await page.keyboard.press('k')
    await page.goBack()
    await dropChannel(page)
    await expect(page.getByText('Your column choices changed. Finding personal data again resets your review decisions.')).toBeVisible()

    await page.getByRole('button', { name: /^Find personal data in/ }).click()
    const reset = page.getByRole('dialog', { name: 'Reset your review?' })
    await expect(reset.getByRole('button', { name: 'Keep working' })).toBeFocused()
    await reset.getByRole('button', { name: 'Keep working' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose what to check')

    await page.getByRole('button', { name: /^Find personal data in/ }).click()
    await reset.getByRole('button', { name: 'Find again' }).click()
    await expect(page.getByText(/^0 reviewed, \d+ left$/)).toBeVisible()
  })
})

test('the German question reads in German', async ({ page }) => {
  await sample(page, '/de/')
  await dropChannel(page, 'Weglassen')
  await page.getByRole('button', { name: 'Neu beginnen' }).click()
  const asked = page.getByRole('dialog', { name: 'Neu beginnen?' })
  await expect(asked).toContainText('Ihre Datei und Ihre Prüfentscheidungen werden gelöscht.')
  await expect(asked.getByRole('button', { name: 'Weiterarbeiten' })).toBeFocused()
})
