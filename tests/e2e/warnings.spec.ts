import type { Download, Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Warnings for text that could identify someone (#66): kept unless removed,
// decided with the same keys as findings, and never the only cue a colour.
// All examples are invented.
const ROWS = [
  ['id', 'message'],
  ['1', 'Ich bin 42 Jahre alt, schreiben Sie an vera.lind@example.com'],
  ['2', 'As the only female CFO here, I need audit logs.'],
  ['3', 'Der Export dauert zu lange.'],
]
const csv = ROWS.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

async function openReview(page: Page) {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({ name: 'feedback.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: /Find personal data/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
}

async function text(download: Download) {
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

const warningMark = (page: Page, text: string) => page.locator('[data-warning]').filter({ hasText: text })

test('warnings are listed after the personal data and say what they are', async ({ page }) => {
  await openReview(page)
  await expect(page.getByText('2 warnings to check')).toBeVisible()
  const group = page.getByRole('region', { name: 'Could identify someone' })
  await expect(group.getByRole('button')).toHaveCount(3) // "Remove all 2" and the two warnings
  await group.getByRole('button', { name: /“The only …”, row 2, not checked: only female CFO/ }).click()
  const note = page.getByRole('complementary')
  await expect(note).toContainText('Could identify someone, row 2')
  await expect(note).toContainText('“The only …”. It describes one person.')
  await expect(note).toContainText('It stays in the file unless you remove it. Removing it replaces it with [ROLE_1].')
})

test('in the text, a warning is a dashed underline with a label, not only a colour', async ({ page }) => {
  await openReview(page)
  await page.getByRole('tab', { name: 'By row' }).click()
  const age = warningMark(page, '42 Jahre alt')
  await expect(age).toHaveAttribute('aria-label', 'Could identify someone: Exact age, not checked: 42 Jahre alt')
  await expect(age.locator('span')).toHaveCSS('text-decoration-style', 'dashed')
})

test('R removes and K keeps a warning, Z undoes, and the cleaned file follows', async ({ page }) => {
  await openReview(page)
  await page.getByRole('tab', { name: 'By row' }).click()
  await warningMark(page, '42 Jahre alt').click()
  await page.keyboard.press('k')
  await expect(warningMark(page, '42 Jahre alt')).toHaveAttribute('aria-label', /kept: 42 Jahre alt/)
  // Keeping moves on to the next open item in reading order: the email in the same row.
  await expect(page.locator('[data-finding][aria-current="true"]')).toContainText('vera.lind@example.com')
  await warningMark(page, 'only female CFO').click()
  await page.keyboard.press('r')
  await expect(warningMark(page, '[ROLE_1]')).toBeVisible()
  await page.keyboard.press('z')
  await expect(warningMark(page, 'only female CFO')).toHaveAttribute('aria-label', /not checked/)
  await warningMark(page, 'only female CFO').click()
  await page.keyboard.press('r')
  await expect(page.getByText('warnings to check')).toHaveCount(0)

  await page.getByRole('link', { name: 'Continue to download' }).click()
  await expect(page.getByText('Could identify someone: 1 removed, 1 kept.')).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download feedback_cleaned/ }).click()])
  const cleaned = await text(download)
  expect(cleaned).toContain('Ich bin 42 Jahre alt, schreiben Sie an [EMAIL_1]')
  expect(cleaned).toContain('As the [ROLE_1] here, I need audit logs.')
  const [report] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download cleaning report (.txt)' }).click()])
  expect(await text(report)).toContain('Could identify someone: 1 removed, 1 kept.')
})

test('warnings never hold up the review: an untouched warning stays in the file', async ({ page }) => {
  await openReview(page)
  await page.getByRole('link', { name: 'Continue to download' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download feedback_cleaned/ }).click()])
  const cleaned = await text(download)
  expect(cleaned).toContain('Ich bin 42 Jahre alt')
  expect(cleaned).toContain('the only female CFO')
  await expect(page.getByText('Could identify someone: 0 removed, 2 kept.')).toBeVisible()
})
