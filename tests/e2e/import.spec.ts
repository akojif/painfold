import { readFileSync } from 'node:fs'
import { utils, write } from 'xlsx'
import { guessFeedbackColumn, suggestRoles } from '../../core/columns/roles'
import { detectTable } from '../../core/detect/table'
import { importFile } from '../../core/import'
import { GERMAN_EXCEL_TEXT, windows1252 } from '../fixtures/german-excel'
import { expect, test } from './fixtures'

const sampleCsv = readFileSync(new URL('../../data/sample/support-tickets.csv', import.meta.url))
const fileInput = (page: import('@playwright/test').Page) => page.getByTestId('file-input')

function upload(page: import('@playwright/test').Page, name: string, buffer: Buffer | Uint8Array, mimeType = 'text/csv') {
  return fileInput(page).setInputFiles({ name, mimeType, buffer: Buffer.from(buffer) })
}

test.describe('start screen', () => {
  test('shows the privacy notice, the sample file and what is detected', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Your file is never uploaded. It stays in this browser.')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Try the sample file' })).toBeVisible()
    await expect(page.getByText('200 made-up support tickets. Fake data, no real people.')).toBeVisible()
    await expect(page.getByText('Finds email addresses, links, and IP addresses.')).toBeVisible()
    await expect(page.getByText('Names are not detected yet.')).toBeVisible()
  })

  test('marks the current step in the step rail', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Steps' }).locator('[aria-current="step"]')).toHaveText(/Import/)
  })
})

test.describe('choosing a file', () => {
  test('a CSV is read, the feedback column guessed and personal columns dropped', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('support-tickets.csv, 200 rows')
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await expect(page.getByLabel('Feedback column')).toHaveValue('8')

    const email = page.getByRole('group', { name: 'What happens to customer_email' })
    await expect(email.getByRole('radio', { name: 'Drop' })).toBeChecked()
    await expect(page.getByText('Looks like personal data (“email”), so it is left out of the cleaned file.')).toBeVisible()
    await expect(page.getByRole('group', { name: 'What happens to channel' }).getByRole('radio', { name: 'Check' })).toBeChecked()
    await expect(page.getByRole('group', { name: 'What happens to rating' }).getByRole('radio', { name: 'Keep as is' })).toBeChecked()
    await expect(page.getByText('Keep as is: copied to the cleaned file without checking.').first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'customer_email' })).toHaveClass(/line-through/)
  })

  test('roles can be changed with the arrow keys', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    const channel = page.getByRole('group', { name: 'What happens to channel' })
    await channel.getByRole('radio', { name: 'Check' }).focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(channel.getByRole('radio', { name: 'Drop' })).toBeChecked()
    await expect(page.getByRole('columnheader', { name: 'channel' })).toHaveClass(/line-through/)
  })

  test('choosing another feedback column gives the old one its suggested role back', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    await page.getByLabel('Feedback column').selectOption('channel')
    await expect(page.getByRole('group', { name: 'What happens to message' }).getByRole('radio', { name: 'Check' })).toBeChecked()
    await expect(page.getByRole('group', { name: 'What happens to channel' })).toHaveCount(0)
  })

  test('a CSV saved by German Excel keeps its umlauts', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'Rückmeldungen.csv', windows1252(GERMAN_EXCEL_TEXT))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rückmeldungen.csv, 3 rows')
    await expect(page.getByLabel('Feedback column')).toHaveValue('3')
    const preview = page.getByRole('region', { name: 'Preview of the first rows' })
    await expect(preview.getByRole('columnheader', { name: 'Rückmeldung' })).toBeVisible()
    await expect(preview.getByText('Größere Schrift wäre schön; sonst top.')).toBeVisible()
  })

  test('a workbook with several sheets offers a sheet picker', async ({ page }) => {
    const book = utils.book_new()
    utils.book_append_sheet(book, utils.aoa_to_sheet([['text'], ['Erste Tabelle, erste Zeile mit Feedback']]), 'Januar')
    utils.book_append_sheet(book, utils.aoa_to_sheet([['text'], ['Second sheet with some feedback text']]), 'Februar')
    await page.goto('/')
    await upload(page, 'tickets.xlsx', write(book, { type: 'buffer', bookType: 'xlsx' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    await expect(page.getByText('Erste Tabelle, erste Zeile mit Feedback').first()).toBeVisible()
    await page.getByLabel('Sheet').selectOption('Februar')
    await expect(page.getByText('Second sheet with some feedback text').first()).toBeVisible()
  })

  test('the sample file is labelled as fake data', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try the sample file' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('support-tickets.csv, 200 rows')
    await expect(page.getByText('Sample file with fake data.')).toBeVisible()
  })

  test('"Choose another file" returns to the start', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    await page.getByRole('button', { name: 'Choose another file' }).click()
    await expect(page.getByRole('button', { name: 'Choose a file' })).toBeVisible()
  })
})

test.describe('import errors', () => {
  for (const [name, content, message] of [
    ['old.xls', 'x', 'This is an old Excel file (.xls). Open it in Excel, save it as .xlsx or .csv, then choose it again.'],
    ['empty.csv', '', 'This file is empty. Choose a file with a header row and at least one row of feedback.'],
    ['header.csv', 'id,text\n', 'This file only has a header row. Add rows of feedback, or choose another file.'],
    ['notes.pdf', '%PDF', 'Painfold reads CSV and XLSX files. Export your data in one of those formats and choose it again.'],
  ] as const) {
    test(`${name} explains what to do next`, async ({ page }) => {
      await page.goto('/')
      await upload(page, name, Buffer.from(content))
      await expect(page.getByRole('alert')).toHaveText(message)
      await upload(page, 'support-tickets.csv', sampleCsv)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('support-tickets.csv, 200 rows')
    })
  }
})

test.describe('finding personal data', () => {
  test('checks the chosen columns in a worker and opens the review step', async ({ page }) => {
    const table = await importFile({ name: 'support-tickets.csv', bytes: sampleCsv })
    const roles = suggestRoles(table).map(suggestion => suggestion.role)
    roles[guessFeedbackColumn(table)!] = 'scan'
    const scan = roles.flatMap((role, index) => (role === 'scan' ? [index] : []))
    const expected = detectTable(table.rows, scan).reduce((sum, cell) => sum + cell.detections.length, 0)
    expect(expected).toBeGreaterThan(0)

    const workers: string[] = []
    page.on('worker', worker => workers.push(worker.url()))
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    await page.getByRole('button', { name: 'Find personal data in 200 rows' }).click()

    await expect(page).toHaveURL(/\/review$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${expected} findings in 200 rows`)
    await expect(page.getByRole('navigation', { name: 'Steps' }).locator('[aria-current="step"]')).toHaveText(/Review/)
    expect(workers.some(url => url.includes('/_nuxt/detect.worker'))).toBe(true)
  })

  test('the review step without a checked file goes back to the start', async ({ page }) => {
    await page.goto('/review')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: 'Choose a file' })).toBeVisible()
  })
})

test.describe('small screens', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('show the step as text and never scroll sideways', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    await expect(page.getByText('Step 1 of 3, Import')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
