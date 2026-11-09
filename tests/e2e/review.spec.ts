import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Three findings: the same email twice, and an IP address. "Anna Huber" is a
// name, which Stage 1 does not detect, in rows 1 and 3.
const CSV = [
  'id,message',
  '1,"Bitte an anna@example.com schreiben, danke. Anna Huber"',
  '2,"Nochmal: anna@example.com, bitte rasch antworten"',
  '3,"Kein Fund hier, nur Anna Huber wird erwähnt"',
  '4,"Unser Server 192.0.2.7 meldet seit gestern Fehler"',
].join('\n')

async function openReview(page: Page, csv = CSV) {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({ name: 'tickets.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: /Find personal data/ }).click()
  await expect(page).toHaveURL(/\/review$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

const row = (page: Page, n: number) => page.locator('main ol > li').filter({ hasText: `Row ${n}` }).first()
const progress = (page: Page) => page.getByText(/reviewed, .* left/)
const current = (page: Page) => page.locator('[data-finding][aria-current="true"]')

async function selectText(page: Page, rowNumber: number, text: string) {
  await row(page, rowNumber).locator('[data-offset]').filter({ hasText: text }).first().evaluate((element, wanted) => {
    const node = element.firstChild!
    const at = node.textContent!.indexOf(wanted)
    const range = document.createRange()
    range.setStart(node, at)
    range.setEnd(node, at + wanted.length)
    getSelection()!.removeAllRanges()
    getSelection()!.addRange(range)
  }, text)
}

test.describe('review step', () => {
  test('shows every row, the findings by type, progress and the limits notice', async ({ page }) => {
    await openReview(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('3 findings in 4 rows')
    await expect(progress(page)).toHaveText('0 reviewed, 3 left')
    await expect(page.getByRole('group', { name: 'Show findings' }).getByRole('button')).toHaveText(['All 3', 'Email 2', 'IP 1'])
    await expect(page.getByLabel('Only rows with findings')).not.toBeChecked()
    await expect(page.locator('main ol > li')).toHaveCount(4)
    await expect(row(page, 3)).toContainText('Nothing found in this row')
    await expect(page.getByText('Automatic detection can miss personal data.', { exact: false })).toBeVisible()
    await expect(page.getByText('3 not reviewed will be removed.')).toBeVisible()
  })

  test('Remove (R) replaces every copy, advances, and can be undone (Z)', async ({ page }) => {
    await openReview(page)
    await expect(current(page)).toContainText('anna@example.com')
    await page.keyboard.press('r')
    await expect(row(page, 1)).toContainText('[EMAIL_1]')
    await expect(row(page, 2)).toContainText('[EMAIL_1]')
    await expect(progress(page)).toHaveText('2 reviewed, 1 left')
    await expect(current(page)).toContainText('192.0.2.7')
    await expect(page.locator('[aria-live="polite"]').last()).toHaveText('Email address removed, 1 left.')

    await page.keyboard.press('z')
    await expect(row(page, 1)).toContainText('anna@example.com')
    await expect(progress(page)).toHaveText('0 reviewed, 3 left')
  })

  test('the ink sweep plays when a finding is removed', async ({ page }) => {
    await openReview(page)
    await page.keyboard.press('r')
    await expect(page.locator('.animate-ink-sweep').first()).toBeAttached()
    await expect(row(page, 1).getByRole('button', { name: /Email address, removed: \[EMAIL_1\]/ })).toBeVisible()
  })

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('a removed finding becomes its placeholder at once', async ({ page }) => {
      await openReview(page)
      await page.keyboard.press('r')
      await expect(page.locator('.animate-ink-sweep')).toHaveCount(0)
      await expect(row(page, 1)).toContainText('[EMAIL_1]')
    })
  })

  test('Keep (K) leaves the value in every copy', async ({ page }) => {
    await openReview(page)
    await page.keyboard.press('k')
    await expect(row(page, 2).getByRole('button', { name: 'Email address, kept: anna@example.com' })).toBeVisible()
    await expect(progress(page)).toHaveText('2 reviewed, 1 left')
  })

  test('N and P, and the arrow keys on a finding, move between findings', async ({ page }) => {
    await openReview(page)
    await page.keyboard.press('n')
    await expect(current(page)).toContainText('anna@example.com')
    await expect(current(page)).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(current(page)).toContainText('192.0.2.7')
    await page.keyboard.press('p')
    await expect(current(page)).toContainText('anna@example.com')
  })

  test('the buttons show the same keys that work', async ({ page }) => {
    await openReview(page)
    await expect(page.getByRole('button', { name: 'Remove R' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keep K' })).toBeVisible()
    await page.getByRole('button', { name: 'Keep K' }).click()
    await expect(progress(page)).toHaveText('2 reviewed, 1 left')
  })

  test('missed text is marked as a name, preselected, in every copy (M)', async ({ page }) => {
    await openReview(page)
    await selectText(page, 3, 'Anna Huber')
    await page.keyboard.press('m')
    const type = page.getByLabel('Type')
    await expect(type).toHaveValue('NAME')
    await expect(type).toBeFocused()
    await page.keyboard.press('r') // shortcuts are off while the picker is open
    await expect(progress(page)).toHaveText('0 reviewed, 3 left')
    await page.getByRole('button', { name: 'Mark as personal data' }).click()
    await expect(row(page, 1)).toContainText('[NAME_1]')
    await expect(row(page, 3)).toContainText('[NAME_1]')
    await expect(page.locator('[aria-live="polite"]').last()).toHaveText('Name marked in 2 rows.')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('5 findings in 4 rows')
  })

  test('marking without a selection explains what to do', async ({ page }) => {
    await openReview(page)
    await page.keyboard.press('m')
    await expect(page.getByRole('alert')).toHaveText('Select the missed text in a row first, then press M.')
  })

  test('filters show only rows with findings, or with one type', async ({ page }) => {
    await openReview(page)
    await page.getByLabel('Only rows with findings').check()
    await expect(page.locator('main ol > li')).toHaveCount(3)
    await page.getByLabel('Only rows with findings').uncheck()
    await page.getByRole('button', { name: 'IP 1' }).click()
    await expect(page.locator('main ol > li')).toHaveCount(1)
    await expect(current(page)).toContainText('192.0.2.7')
  })

  test('"Remove all left" decides the rest, and the download step follows', async ({ page }) => {
    await openReview(page)
    await page.getByRole('button', { name: 'Remove all 3 left' }).click()
    await expect(progress(page)).toHaveText('3 reviewed, 0 left')
    await expect(page.getByText(/not reviewed will be removed/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Continue to download' }).click()
    await expect(page).toHaveURL(/\/download$/)
    await expect(page.getByRole('navigation', { name: 'Steps' }).locator('[aria-current="step"]')).toHaveText(/Download/)
  })

  test('the sample file reviews without errors and the stepper marks import done', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try the sample file' }).click()
    await page.getByRole('button', { name: /Find personal data/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/findings in 200 rows/)
    await expect(page.getByRole('navigation', { name: 'Steps' }).getByText('Import, done')).toBeAttached()
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('nothing scrolls sideways', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'Try the sample file' }).click()
      await page.getByRole('button', { name: /Find personal data/ }).click()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    })
  })
})
