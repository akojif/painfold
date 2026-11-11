import type { Download, Page, Request } from '@playwright/test'
import { utils, write } from 'xlsx'
import { expect, test } from './fixtures'

// One file, every kind of decision: a dropped personal column, a checked
// message column, a column kept as is with a formula in it, an email that is
// removed, an IP that is kept, a link nobody reviews, and a name marked by hand.
const ROWS = [
  ['id', 'customer_email', 'message', 'note'],
  ['1', 'anna@example.com', 'Bitte an anna@example.com schreiben. Anna Huber', '=1+1'],
  ['2', 'james@example.org', 'Login von 192.0.2.7, Anna Huber ist informiert', '-2+3'],
  ['3', 'sophie@example.net', 'Siehe https://example.com/rechnung/88213 bitte', '@SUM(A1)'],
]
const csvText = ROWS.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
const xlsxBytes = () => {
  const book = utils.book_new()
  utils.book_append_sheet(book, utils.aoa_to_sheet(ROWS), 'Tickets')
  return Buffer.from(write(book, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array)
}

async function text(download: Download) {
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/** Runs the whole flow and returns every request made after the page loaded, and the downloaded file. */
async function cleanFile(page: Page, file: { name: string, mimeType: string, buffer: Buffer }) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const requests: Request[] = []
  page.on('request', request => requests.push(request))

  await page.getByTestId('file-input').setInputFiles(file)
  await expect(page.getByRole('group', { name: 'What happens to customer_email' }).getByRole('radio', { name: 'Drop' })).toBeChecked()
  const note = page.getByRole('group', { name: 'What happens to note' })
  await note.locator('label', { hasText: 'Keep as is' }).click()
  await expect(note.getByRole('radio', { name: 'Keep as is' })).toBeChecked()
  await page.getByRole('button', { name: /Find personal data/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
  await page.getByRole('tab', { name: 'By row' }).click()

  await page.keyboard.press('r') // the email: removed
  await expect(page.locator('[data-finding][aria-current="true"]')).toContainText('192.0.2.7')
  await page.keyboard.press('k') // the IP: kept
  await page.locator('main ol > li').first().locator('[data-offset]').filter({ hasText: 'Anna Huber' }).evaluate((element) => {
    const node = element.firstChild!
    const at = node.textContent!.indexOf('Anna Huber')
    const range = document.createRange()
    range.setStart(node, at)
    range.setEnd(node, at + 'Anna Huber'.length)
    getSelection()!.removeAllRanges()
    getSelection()!.addRange(range)
  })
  await page.keyboard.press('m')
  await page.getByRole('button', { name: 'Mark as personal data' }).click()
  await expect(page.getByText('1 not reviewed will be removed.')).toBeVisible() // the link

  await page.getByRole('link', { name: 'Continue to download' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your cleaned file is ready.')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download tickets_cleaned/ }).click()])
  const [reportDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download cleaning report (.txt)' }).click()])
  return { requests, download, csv: await text(download), reportDownload, report: await text(reportDownload) }
}

for (const [format, file] of [
  ['CSV', () => ({ name: 'tickets.csv', mimeType: 'text/csv', buffer: Buffer.from(csvText) })],
  ['XLSX', () => ({ name: 'tickets.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsxBytes() })],
] as const) {
  test.describe(`cleaning a ${format} file from import to download`, () => {
    test('sends nothing anywhere: only GET requests for the app\'s own files, none with a body', async ({ page, baseURL }) => {
      const { requests } = await cleanFile(page, file())
      for (const request of requests) {
        expect(request.method(), request.url()).toBe('GET')
        expect(request.postData(), request.url()).toBeNull()
        expect(new URL(request.url()).origin, request.url()).toBe(new URL(baseURL!).origin)
        for (const value of ['anna', 'example.com', '192.0.2.7', 'Huber']) expect(request.url().toLowerCase()).not.toContain(value.toLowerCase())
      }
      await expect(page.getByRole('button', { name: /What leaves your browser/ })).toContainText('0 bytes')
      await page.getByRole('button', { name: /What leaves your browser/ }).click()
      await expect(page.getByRole('dialog', { name: 'What leaves your browser' })).toContainText('No data has left this browser.')
    })

    test('the downloaded file is cleaned as decided', async ({ page }) => {
      const { download, csv } = await cleanFile(page, file())
      expect(download.suggestedFilename()).toBe('tickets_cleaned.csv')
      expect(csv.startsWith('﻿')).toBe(true)
      const lines = csv.slice(1).split('\r\n')
      expect(lines[0]).toBe('id,message,note')
      expect(lines[1]).toBe("1,Bitte an [EMAIL_1] schreiben. [NAME_1],'=1+1")
      expect(lines[2]).toBe("2,\"Login von 192.0.2.7, [NAME_1] ist informiert\",'-2+3")
      expect(lines[3]).toBe("3,Siehe [LINK_1] bitte,'@SUM(A1)")
      expect(lines.slice(4)).toEqual(['']) // data only: nothing after the last row
      expect(csv).not.toContain('Painfold')
      for (const removed of ['anna@example.com', 'james@example.org', 'Anna Huber', 'https://example.com/rechnung/88213']) expect(csv).not.toContain(removed)
    })
  })
}

test('the cleaning report lists the files, date, version, removals and limits', async ({ page }) => {
  const { reportDownload, report } = await cleanFile(page, { name: 'tickets.csv', mimeType: 'text/csv', buffer: Buffer.from(csvText) })
  expect(reportDownload.suggestedFilename()).toBe('tickets_cleaning-report.txt')
  const lines = report.split('\r\n')
  expect(lines[0]).toBe('Painfold cleaning report')
  expect(report).toMatch(/Original file\s+tickets\.csv/)
  expect(report).toMatch(/Cleaned file\s+tickets_cleaned\.csv/)
  expect(report).toMatch(/Rows\s+3/)
  expect(report).toMatch(/Cleaned on\s+\d{4}-\d\d-\d\d \d\d:\d\d \(UTC[+-]\d\d:\d\d\)/)
  expect(report).toMatch(/Painfold version\s+\d+\.\d+\.\d+/)
  expect(report).toMatch(/Email addresses\s+1\r\n/)
  expect(report).toMatch(/Names\s+2\r\n/)
  expect(report).toMatch(/Links\s+1\r\n/)
  expect(report).toContain('Includes 1 finding that was not reviewed.')
  expect(report).toContain('Left out: customer_email.')
  expect(report.replace(/\r\n/g, ' ')).toContain('Automatic detection can miss personal data. Review the results before sharing the cleaned file.')
  for (const removed of ['anna@example.com', 'Anna Huber', 'https://example.com/rechnung/88213']) expect(report).not.toContain(removed)
})

test('the download step summarises what the file contains', async ({ page }) => {
  await cleanFile(page, { name: 'tickets.csv', mimeType: 'text/csv', buffer: Buffer.from(csvText) })
  const summary = page.locator('main')
  await expect(summary).toContainText('Email addresses1')
  await expect(summary).toContainText('Names2')
  await expect(summary).toContainText('Links1')
  await expect(summary).toContainText('Includes 1 finding that was not reviewed.')
  await expect(summary).toContainText('1 finding was kept.')
  await expect(summary).toContainText('Left out: customer_email.')
  await expect(summary).toContainText('Copied without checking: id, note.')
  await expect(summary).toContainText('The cleaned file holds only your data. The cleaning report lists what was replaced')
})

test('a semicolon file is downloaded with semicolons', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({ name: 'de.csv', mimeType: 'text/csv', buffer: Buffer.from('Nr;Rückmeldung\n1;Bitte an anna@example.com schreiben, danke\n') })
  await page.getByRole('button', { name: /Find personal data/ }).click()
  await page.getByRole('link', { name: 'Continue to download' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download de_cleaned/ }).click()])
  const lines = (await text(download)).slice(1).split('\r\n')
  expect(lines.slice(0, 2)).toEqual(['Nr;Rückmeldung', '1;Bitte an [EMAIL_1] schreiben, danke'])
})

test('the privacy panel lists every request, all to this site', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /What leaves your browser/ }).click()
  const dialog = page.getByRole('dialog', { name: 'What leaves your browser' })
  await expect(dialog).toContainText('No data has left this browser.')
  await expect(dialog.getByRole('row')).not.toHaveCount(1)
  await expect(dialog).toContainText('App code')
  await expect(dialog).toContainText('Font')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('Start over after downloading goes back to the start with nothing kept', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the sample file' }).click()
  await page.getByRole('button', { name: /Find personal data/ }).click()
  await page.getByRole('link', { name: 'Continue to download' }).click()
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download support-tickets_cleaned/ }).click()])
  await page.getByRole('button', { name: 'Start over' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find what hurts your customers. Without exposing who they are.')
  await page.goto('/review/')
  await expect(page).toHaveURL(/\/$/)
})
