import { readFileSync } from 'node:fs'
import { utils, write } from 'xlsx'
import { guessFeedbackColumn, suggestRoles } from '../../core/columns/roles'
import { detectTable } from '../../core/detect/table'
import { importFile } from '../../core/import'
import { GERMAN_EXCEL_TEXT, windows1252 } from '../fixtures/german-excel'
import { expect, test } from './fixtures'

const sampleCsv = readFileSync(new URL('../../data/sample/support-tickets.csv', import.meta.url))
const fileInput = (page: import('@playwright/test').Page) => page.getByTestId('file-input')

async function expectLoaded(page: import('@playwright/test').Page, name: string, rows: string) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose what to check')
  await expect(page.getByTitle(name, { exact: true })).toBeVisible()
  await expect(page.getByText(rows, { exact: true })).toBeVisible()
}

const columnRow = (page: import('@playwright/test').Page, column: string) =>
  page.getByRole('region', { name: 'Columns' }).locator(':scope > ul > li').filter({ has: page.getByRole('group', { name: `What happens to ${column}`, exact: true }) })

function upload(page: import('@playwright/test').Page, name: string, buffer: Buffer | Uint8Array, mimeType = 'text/csv') {
  return fileInput(page).setInputFiles({ name, mimeType, buffer: Buffer.from(buffer) })
}

test.describe('start screen', () => {
  test('leads with the headline, one primary action, the sample file and the privacy line', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find what hurts your customers. Without exposing who they are.')
    await expect(page.getByText('Start by cleaning your feedback file: emails, phone numbers, IBANs and more are removed right here in your browser.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Choose a CSV or Excel file' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try the sample file' })).toBeVisible()
    await expect(page.getByText('200 made-up tickets, no real people')).toBeVisible()
    await expect(page.getByText('Your file is never uploaded. It stays in this browser.')).toHaveCount(1)
    await expect(page.getByRole('list', { name: 'What Painfold does' }).getByRole('listitem')).toHaveText([/^Now\s*Clean your file$/, /^v0\.3\s*Find jobs, pains and gains$/, /^v0\.4\s*Decide what to build$/])
    // The hero states the privacy notice, so the footer adds only the other facts here.
    await expect(page.locator('footer').getByRole('list', { name: 'About Painfold' }).getByRole('listitem')).toHaveText(['No cookies', 'No account'])
  })

  test('shows that nothing has left the browser', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /What leaves your browser/ })).toHaveText(/0 bytes/)
  })

  test('the stepper appears once a file is open, with Import as the current step', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Steps' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Try the sample file' }).click()
    await expect(page.getByRole('navigation', { name: 'Steps' }).locator('[aria-current="step"]')).toHaveText(/Import/)
  })

  test('the example ticket ends with its values replaced by placeholders', async ({ page }) => {
    await page.goto('/')
    const example = page.getByRole('figure')
    await expect(example).toContainText('olivia.hartley@example.com')
    await expect(page.locator('figure[data-cleaned]')).toHaveCount(1, { timeout: 5000 })
    await expect(example).toContainText('[EMAIL_1]')
    await expect(example).toContainText('[PHONE_1]')
    // Every found value shows both sides of the change: the original and its placeholder.
    // The list is hidden from screen readers (the figure has a text description), so select its rows directly.
    const found = example.locator('li')
    await expect(found).toHaveCount(5)
    for (const [original, placeholder] of [['olivia.hartley@example.com', '[EMAIL_1]'], ['+44 20 7946 0958', '[PHONE_1]'], ['DE89 3704 0044 0532 0130 00', '[IBAN_1]'], ['27 Willow Lane', '[ADDRESS_1]'], ['12/03/1987', '[DATE_OF_BIRTH_1]']]) {
      await expect(found.filter({ hasText: original })).toContainText(placeholder!)
    }
  })

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('the example ticket shows its end state at once', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('figure[data-cleaned]')).toHaveCount(1, { timeout: 500 })
    })
  })

  test('a file dropped anywhere on the page is read', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('figure').waitFor()
    await page.evaluate(async (text) => {
      const data = new DataTransfer()
      data.items.add(new File([text], 'dropped.csv', { type: 'text/csv' }))
      const target = document.querySelector('footer')!
      for (const type of ['dragenter', 'dragover', 'drop']) target.dispatchEvent(new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }))
    }, 'id,message\n1,Bitte an anna@example.com antworten, danke für die Hilfe\n')
    await expectLoaded(page, 'dropped.csv', '1 row')
  })

  test('dragging a file over the page shows the drop overlay', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('figure').waitFor()
    await page.evaluate(() => {
      const data = new DataTransfer()
      data.items.add(new File(['x'], 'a.csv', { type: 'text/csv' }))
      document.body.dispatchEvent(new DragEvent('dragenter', { dataTransfer: data, bubbles: true, cancelable: true }))
    })
    await expect(page.getByText('Drop to open. Nothing is uploaded.')).toBeVisible()
  })
})

test.describe('choosing a file', () => {
  test('a CSV is read, the feedback column guessed and personal columns dropped', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)

    await expectLoaded(page, 'support-tickets.csv', '200 rows')
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await expect(page.getByRole('radio', { name: 'Use message as the feedback column' })).toBeChecked()
    await expect(page.getByText('Feedback column, always checked')).toBeVisible()

    const email = page.getByRole('group', { name: 'What happens to customer_email' })
    await expect(email.getByRole('radio', { name: 'Drop' })).toBeChecked()
    await expect(columnRow(page, 'customer_email')).toContainText('Looks like email addresses')
    await expect(page.getByRole('group', { name: 'What happens to channel' }).getByRole('radio', { name: 'Check' })).toBeChecked()
    await expect(page.getByRole('group', { name: 'What happens to rating' }).getByRole('radio', { name: 'Keep as is' })).toBeChecked()
    await expect(columnRow(page, 'rating')).toContainText('Only numbers and dates')
  })

  test('the feedback column comes first, then columns that look personal, then the rest', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    const names = page.getByRole('region', { name: 'Columns' }).locator(':scope > ul > li > div:first-of-type > p:first-child')
    await expect(names).toHaveText(['message', 'customer_name', 'customer_email', 'id', 'created_at', 'channel', 'rating', 'plan', 'country'])
  })

  test('sample values of dropped columns are masked, the same length for every value', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    const email = columnRow(page, 'customer_email')
    await expect(email).toContainText('Values hidden because this column is dropped')
    await expect(email).not.toContainText('@')
    const masks = await email.locator('[aria-hidden="true"]').allTextContents()
    expect(new Set(masks).size).toBe(1)
    await email.getByText('Check', { exact: true }).click()
    await expect(email).toContainText('@example.')
  })

  test('roles can be changed with the arrow keys, and the summary follows', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    await expect(page.getByText('Cleaned file: 7 columns, 4 checked, 3 kept as is, 2 dropped')).toBeVisible()
    const channel = page.getByRole('group', { name: 'What happens to channel' })
    await channel.getByRole('radio', { name: 'Check' }).focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(channel.getByRole('radio', { name: 'Drop' })).toBeChecked()
    await expect(page.getByText('Cleaned file: 6 columns, 3 checked, 3 kept as is, 3 dropped')).toBeVisible()
  })

  test('another feedback column is chosen in place and the old one gets its suggested role back', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    await page.getByRole('radio', { name: 'Use channel as the feedback column' }).check()
    await expect(page.getByRole('group', { name: 'What happens to message' }).getByRole('radio', { name: 'Check' })).toBeChecked()
    await expect(page.getByRole('group', { name: 'What happens to channel' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Columns' }).locator(':scope > ul > li').first()).toContainText('message')
  })

  test('the feedback column can be chosen with the arrow keys', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    await page.getByRole('radio', { name: 'Use message as the feedback column' }).focus()
    await page.keyboard.press('ArrowDown')
    const next = page.getByRole('radio', { name: 'Use customer_name as the feedback column' })
    await expect(next).toBeChecked()
    await expect(next).toBeFocused()
  })

  test('a column kept as is that holds personal data is flagged with a count and fixed in one click', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'refs.csv', Buffer.from([
      'message,callback,notes',
      '"Bitte zurückrufen, der Export bricht nach 90 Tagen ab",+43 660 234 2972,',
      '"Please call me back about the invoice next week",+49 30 23125 417,',
      '"Die App stürzt beim Öffnen der Rechnungen ab, bitte prüfen",2026-01-04,',
    ].join('\n')))
    const callback = columnRow(page, 'callback')
    await expect(callback.getByRole('radio', { name: 'Keep as is' })).toBeChecked()
    await expect(callback).toContainText('Contains 2 phone numbers.')
    await callback.getByRole('button', { name: 'Check it instead' }).click()
    await expect(callback.getByRole('radio', { name: 'Check' })).toBeChecked()
    await expect(callback.getByRole('radio', { name: 'Check' })).toBeFocused()
    await expect(callback).not.toContainText('Contains')

    const notes = columnRow(page, 'notes')
    await expect(notes).toContainText('Empty column')
    await expect(notes.getByRole('radio', { name: 'Keep as is' })).toBeChecked()
  })

  test('the preview is collapsed and shows only the columns of the cleaned file, without scrolling sideways', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    const preview = page.getByRole('region', { name: 'Preview of the first rows' })
    await expect(preview).toBeHidden()
    await page.getByText('Show first 5 rows').click()
    await expect(preview.getByRole('columnheader')).toHaveText(['id', 'created_at', 'channel', 'rating', 'plan', 'country', 'message'])
    expect(await preview.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
  })

  test('a CSV saved by German Excel keeps its umlauts', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'Rückmeldungen.csv', windows1252(GERMAN_EXCEL_TEXT))
    await expectLoaded(page, 'Rückmeldungen.csv', '3 rows')
    await expect(page.getByRole('radio', { name: 'Use Rückmeldung as the feedback column' })).toBeChecked()
    await page.getByText('Show first 3 rows').click()
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
    await expectLoaded(page, 'support-tickets.csv', '200 rows')
    await expect(page.getByText('Sample file with fake data.')).toBeVisible()
  })

  test('"Choose another file" returns to the start', async ({ page }) => {
    await page.goto('/')
    await upload(page, 'support-tickets.csv', sampleCsv)
    await page.getByRole('button', { name: 'Choose another file' }).click()
    await expect(page.getByRole('button', { name: 'Choose a CSV or Excel file' })).toBeVisible()
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
      await expectLoaded(page, 'support-tickets.csv', '200 rows')
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
    await expect(page.getByRole('button', { name: 'Choose a CSV or Excel file' })).toBeVisible()
  })
})

test.describe('small screens', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('never scroll sideways, before or after a file is chosen', async ({ page }) => {
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    await page.goto('/')
    await expect(page.locator('figure[data-cleaned]')).toHaveCount(1, { timeout: 5000 })
    expect(await overflow()).toBeLessThanOrEqual(0)
    await upload(page, 'support-tickets.csv', sampleCsv)
    await expectLoaded(page, 'support-tickets.csv', '200 rows')
    expect(await overflow()).toBeLessThanOrEqual(0)
  })
})
