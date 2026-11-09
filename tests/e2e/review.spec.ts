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
const currentValue = (page: Page) => page.locator('[data-value][aria-current="true"]')
const values = (page: Page) => page.getByRole('navigation', { name: 'Values found' })

async function byRow(page: Page) {
  await page.getByRole('tab', { name: 'By row' }).click()
  await expect(page.getByRole('tab', { name: 'By row' })).toHaveAttribute('aria-selected', 'true')
}

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
  test('opens by value: each value once, grouped by type, with progress and the limits notice', async ({ page }) => {
    await openReview(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('3 findings in 4 rows')
    await expect(progress(page)).toHaveText('0 reviewed, 3 left')
    await expect(page.getByRole('tab', { name: 'By value' })).toHaveAttribute('aria-selected', 'true')
    await expect(values(page).getByRole('heading')).toHaveText(['Email addresses', 'IP addresses'])
    await expect(values(page).locator('[data-value]')).toHaveCount(2)
    await expect(currentValue(page)).toHaveAccessibleName('Email address, not reviewed: anna@example.com')
    await expect(page.getByText('Appears in 2 rows. Removing it replaces every copy with [EMAIL_1].')).toBeVisible()
    await expect(page.locator('main ol > li')).toHaveCount(2)
    await expect(page.getByText('Automatic detection can miss personal data.', { exact: false })).toBeVisible()
    await expect(page.getByText('3 not reviewed will be removed.')).toBeVisible()
  })

  test('Remove (R) replaces the value with its placeholder, advances, and can be undone (Z)', async ({ page }) => {
    await openReview(page)
    await page.keyboard.press('r')
    await expect(values(page).getByRole('button', { name: 'Email address, removed: [EMAIL_1]' })).toBeVisible()
    await expect(progress(page)).toHaveText('2 reviewed, 1 left')
    await expect(currentValue(page)).toHaveAccessibleName(/192\.0\.2\.7/)
    await expect(currentValue(page)).toBeFocused()
    await expect(page.locator('[aria-live="polite"]').last()).toHaveText('Email address removed, 1 left.')

    await page.keyboard.press('z')
    await expect(values(page).getByRole('button', { name: 'Email address, not reviewed: anna@example.com' })).toBeVisible()
    await expect(progress(page)).toHaveText('0 reviewed, 3 left')
  })

  test('Keep (K) marks the value as kept', async ({ page }) => {
    await openReview(page)
    await page.keyboard.press('k')
    await expect(values(page).getByRole('button', { name: 'Email address, kept: anna@example.com' })).toContainText('Kept')
    await expect(progress(page)).toHaveText('2 reviewed, 1 left')
  })

  test('a keyboard removal fades the placeholder in; a click wipes it in', async ({ page }) => {
    await openReview(page)
    await page.keyboard.press('r')
    await expect(values(page).locator('.animate-token-fade')).toHaveCount(1)
    await expect(page.locator('.animate-token-wipe')).toHaveCount(0)
    await page.getByRole('button', { name: 'Remove R' }).click()
    await expect(values(page).locator('.animate-token-wipe')).toHaveCount(1)
  })

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('a removed value becomes its placeholder without animation', async ({ page }) => {
      await openReview(page)
      await page.getByRole('button', { name: 'Remove R' }).click()
      const token = values(page).getByText('[EMAIL_1]')
      await expect(token).toBeVisible()
      await expect(token).toHaveCSS('animation-name', 'none')
    })
  })

  test('"Remove all" in a type heading removes only that type, in one undo step', async ({ page }) => {
    await openReview(page)
    await values(page).getByRole('button', { name: 'Remove all 2 email addresses' }).click()
    await expect(progress(page)).toHaveText('2 reviewed, 1 left')
    await expect(values(page).getByRole('button', { name: /Remove all .* email addresses/ })).toHaveCount(0)
    await expect(values(page).getByRole('button', { name: 'Remove 1 IP address' })).toBeVisible()
    await page.keyboard.press('z')
    await expect(progress(page)).toHaveText('0 reviewed, 3 left')
  })

  test('N and P, and the arrow keys on a value, move between values', async ({ page }) => {
    await openReview(page)
    await page.keyboard.press('n')
    await expect(currentValue(page)).toHaveAccessibleName(/192\.0\.2\.7/)
    await expect(currentValue(page)).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(currentValue(page)).toHaveAccessibleName(/anna@example\.com/)
  })

  test('the buttons show the same keys that work', async ({ page }) => {
    await openReview(page)
    await expect(page.getByRole('button', { name: 'Remove R' })).toBeVisible()
    await page.getByRole('button', { name: 'Keep K' }).click()
    await expect(progress(page)).toHaveText('2 reviewed, 1 left')
  })

  test('when everything is reviewed, the next step is offered', async ({ page }) => {
    await openReview(page)
    await page.keyboard.press('r')
    await page.keyboard.press('k')
    await expect(page.getByRole('status')).toContainText('All findings are reviewed.')
    await expect(page.getByRole('status')).toContainText('2 removed, 1 kept.')
    await page.getByRole('status').getByRole('link', { name: 'Continue to download' }).click()
    await expect(page).toHaveURL(/\/download$/)
  })

  test.describe('by row', () => {
    test('shows every row, and only rows with findings on request', async ({ page }) => {
      await openReview(page)
      await byRow(page)
      await expect(page.locator('main ol > li')).toHaveCount(4)
      await expect(row(page, 3)).toContainText('Nothing found in this row')
      await page.getByLabel('Only rows with findings').check()
      await expect(page.locator('main ol > li')).toHaveCount(3)
    })

    test('Remove (R) replaces every copy and advances', async ({ page }) => {
      await openReview(page)
      await byRow(page)
      await expect(current(page)).toContainText('anna@example.com')
      await page.keyboard.press('r')
      await expect(row(page, 1)).toContainText('[EMAIL_1]')
      await expect(row(page, 2)).toContainText('[EMAIL_1]')
      await expect(current(page)).toContainText('192.0.2.7')
    })

    test('N and P, and the arrow keys on a finding, move between findings', async ({ page }) => {
      await openReview(page)
      await byRow(page)
      await page.keyboard.press('n')
      await expect(current(page)).toContainText('anna@example.com')
      await expect(current(page)).toBeFocused()
      await page.keyboard.press('ArrowDown')
      await expect(current(page)).toContainText('192.0.2.7')
      await page.keyboard.press('p')
      await expect(current(page)).toContainText('anna@example.com')
    })

    test('missed text is marked as a name, preselected, in every copy (M)', async ({ page }) => {
      await openReview(page)
      await byRow(page)
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

    test('possible forms of marked text are flagged for review, not removed', async ({ page }) => {
      await openReview(page, [
        'id,message',
        '1,"Anna rief wegen der Rechnung an, bitte zurückrufen"',
        '2,"Annas Rechnung ist doppelt abgebucht worden"',
        '3,"Anna\'s invoice was charged twice last month"',
      ].join('\n'))
      await byRow(page)
      await selectText(page, 1, 'Anna')
      await page.keyboard.press('m')
      await page.getByRole('button', { name: 'Mark as personal data' }).click()
      await expect(page.locator('[aria-live="polite"]').last()).toHaveText('Name marked in 1 row. 2 possible forms to review.')
      await expect(row(page, 1)).toContainText('[NAME_1]')
      await expect(row(page, 2).getByRole('button', { name: 'Name, not reviewed: Anna' })).toBeVisible()
      await expect(row(page, 3).getByRole('button', { name: 'Name, not reviewed: Anna' })).toBeVisible()
      await expect(progress(page)).toHaveText('1 reviewed, 2 left')

      await row(page, 2).getByRole('button', { name: 'Name, not reviewed: Anna' }).click()
      await expect(page.getByText('Looks like a form of “Anna”, which you marked. Removing it replaces it with [NAME_1].')).toBeVisible()
      await page.keyboard.press('r')
      await expect(row(page, 2)).toContainText('[NAME_1]s Rechnung')
    })
  })

  test('marking without a selection explains what to do', async ({ page }) => {
    await openReview(page)
    await page.keyboard.press('m')
    await expect(page.getByRole('alert')).toHaveText('Select the missed text in a row first, then press M.')
  })

  test('"Remove all left" decides the rest, and the download step follows', async ({ page }) => {
    await openReview(page)
    await page.getByRole('button', { name: 'Remove all 3 left' }).click()
    await expect(progress(page)).toHaveText('3 reviewed, 0 left')
    await expect(page.getByText(/not reviewed will be removed/)).toHaveCount(0)
    await page.getByRole('link', { name: 'Continue to download' }).last().click()
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

    test('nothing scrolls sideways in either view', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'Try the sample file' }).click()
      await page.getByRole('button', { name: /Find personal data/ }).click()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      await byRow(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    })
  })
})
