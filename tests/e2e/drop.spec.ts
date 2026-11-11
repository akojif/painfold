import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { utils, write } from 'xlsx'
import { expect, test } from './fixtures'

// Files dropped anywhere, on every step, and what each kind of file does.

const sampleCsv = readFileSync(new URL('../../data/sample/support-tickets.csv', import.meta.url))
const xlsx = () => {
  const book = utils.book_new()
  utils.book_append_sheet(book, utils.aoa_to_sheet([['message'], ['Danke, Anna!'], ['Bitte an anna@example.com']]), 'Feedback')
  return Buffer.from(write(book, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array)
}
// A DOCX as far as identifying it goes: a ZIP whose entries include word/document.xml.
const docx = () => Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from('....[Content_Types].xml....word/document.xml....')])

/** Drops a file on an element, as a browser does: dragenter, dragover, drop. */
async function drop(page: Page, name: string, content: Buffer, on = 'main') {
  await page.locator(on).first().evaluate((target, { name, bytes }) => {
    const data = new DataTransfer()
    data.items.add(new File([new Uint8Array(bytes)], name))
    for (const type of ['dragenter', 'dragover', 'drop']) target.dispatchEvent(new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }))
  }, { name, bytes: [...content] })
}

const heading = (page: Page) => page.getByRole('heading', { level: 1 })
const toast = (page: Page) => page.getByTestId('toast')
const DOCUMENT_NOTE = 'Documents and transcripts are on the roadmap. For now, Painfold reads CSV and Excel files.'

test.describe('on the start screen', () => {
  test('CSV and Excel files open', async ({ page }) => {
    await page.goto('/')
    await drop(page, 'tickets.csv', sampleCsv)
    await expect(heading(page)).toHaveText('Choose what to check')
    await expect(page.getByText('200 rows', { exact: true })).toBeVisible()

    await page.goto('/')
    await drop(page, 'feedback.xlsx', xlsx(), 'footer')
    await expect(heading(page)).toHaveText('Choose what to check')
    await expect(page.getByText('2 rows', { exact: true })).toBeVisible()
  })

  for (const [name, content] of [
    ['interview.docx', docx()],
    ['report.pdf', Buffer.from('%PDF-1.7 ...')],
    ['interview.txt', Buffer.from('Interviewer: Wie war es?\nAnna: Gut, danke.\nInterviewer: Und sonst?')],
    ['call.vtt', Buffer.from('WEBVTT\n\n00:00.000 --> 00:02.000\nHallo')],
  ] as const) {
    test(`${name} gets a friendly note about documents, with a link to the roadmap`, async ({ page }) => {
      await page.goto('/')
      await drop(page, name, content)
      await expect(toast(page)).toContainText(DOCUMENT_NOTE)
      await expect(page.getByRole('status').filter({ has: toast(page) })).toHaveCount(1)
      await toast(page).getByRole('link', { name: 'See the roadmap' }).click()
      await expect(page).toHaveURL(/\/roadmap\/$/)
    })
  }

  test('a .txt that reads as a table opens as one', async ({ page }) => {
    await page.goto('/')
    await drop(page, 'export.txt', Buffer.from('id;message\n1;Danke, Anna\n2;Bitte zurückrufen'))
    await expect(heading(page)).toHaveText('Choose what to check')
  })

  test('anything else says it is not supported, and which files are', async ({ page }) => {
    await page.goto('/')
    await drop(page, 'photo.png', Buffer.from([0x89, 0x50, 0x4E, 0x47]))
    await expect(toast(page)).toContainText('That file type isn\'t supported. Painfold reads CSV, TSV and Excel (.xlsx) files.')
  })

  test('choosing a document in the file picker gives the same note', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('file-input').setInputFiles({ name: 'interview.docx', mimeType: 'application/octet-stream', buffer: docx() })
    await expect(toast(page)).toContainText(DOCUMENT_NOTE)
  })
})

test.describe('during a review', () => {
  const startReview = async (page: Page) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try the sample file' }).click()
    await page.getByRole('button', { name: /^Find personal data in/ }).click()
    await expect(heading(page)).toHaveText(/findings in 200 rows$/)
  }

  test('dropping a new table asks first; Keep working keeps the review, Start over opens the new file', async ({ page }) => {
    await startReview(page)
    await drop(page, 'feedback.xlsx', xlsx())
    const asked = page.getByRole('dialog', { name: 'Start over?' })
    await expect(asked).toBeVisible()
    await asked.getByRole('button', { name: 'Keep working' }).click()
    await expect(heading(page)).toHaveText(/findings in 200 rows$/)

    await drop(page, 'feedback.xlsx', xlsx())
    await asked.getByRole('button', { name: 'Start over' }).click()
    await expect(heading(page)).toHaveText('Choose what to check')
    await expect(page.getByText('2 rows', { exact: true })).toBeVisible()
  })

  test('dropping a document leaves the review alone and says why, in place', async ({ page }) => {
    await startReview(page)
    await drop(page, 'interview.docx', docx())
    await expect(page.getByRole('dialog', { name: 'Start over?' })).toBeHidden()
    await expect(toast(page)).toContainText(DOCUMENT_NOTE)
    await expect(heading(page)).toHaveText(/findings in 200 rows$/)
    await toast(page).getByRole('button', { name: 'Close' }).click()
    await expect(toast(page)).toHaveCount(0)
  })
})

test.describe('a dropped file that does not open', () => {
  test('shows its message on the drop sheet first, then the sheet shrinks into the toast', async ({ page }) => {
    await page.goto('/')
    await drop(page, 'interview.docx', docx())
    const sheet = page.getByTestId('drop-sheet')
    await expect(sheet).toHaveText(DOCUMENT_NOTE)
    await expect(toast(page)).toHaveCount(0)
    await expect(toast(page)).toContainText(DOCUMENT_NOTE, { timeout: 4000 })
    await expect(toast(page).getByRole('link', { name: 'See the roadmap' })).toBeVisible()
    await expect(page.getByTestId('drop-overlay')).toHaveCount(0)
  })

  test('a file chosen in the picker goes straight to the toast', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('file-input').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47]) })
    await expect(toast(page)).toBeVisible({ timeout: 1000 })
    await expect(page.getByTestId('drop-overlay')).toHaveCount(0)
  })

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })
    test('the toast simply appears', async ({ page }) => {
      await page.goto('/')
      await drop(page, 'interview.docx', docx())
      await expect(toast(page)).toContainText(DOCUMENT_NOTE, { timeout: 1000 })
      await expect(page.getByTestId('drop-sheet')).toHaveCount(0)
    })
  })
})

test.describe('the toast', () => {
  test('leaves after about 8 seconds, but not while hovered or focused', async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    await page.getByTestId('file-input').setInputFiles({ name: 'interview.docx', mimeType: 'application/octet-stream', buffer: docx() })
    await expect(toast(page)).toBeVisible()
    await toast(page).hover()
    await page.clock.runFor(10_000)
    await expect(toast(page)).toBeVisible()
    await page.mouse.move(0, 0)
    await page.clock.runFor(9_000)
    await expect(toast(page)).toHaveCount(0)

    await page.getByTestId('file-input').setInputFiles({ name: 'interview.docx', mimeType: 'application/octet-stream', buffer: docx() })
    await toast(page).getByRole('link', { name: 'See the roadmap' }).focus()
    await page.clock.runFor(10_000)
    await expect(toast(page)).toBeVisible()
  })

  test('nothing on the page moves, and it sits above the column step\'s action bar', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try the sample file' }).click()
    const find = page.getByRole('button', { name: /^Find personal data in/ })
    const before = await find.boundingBox()
    await drop(page, 'interview.docx', docx())
    await expect(toast(page)).toBeVisible()
    expect(await find.boundingBox()).toEqual(before)
    const bar = (await page.locator('[data-toast-avoid]').first().boundingBox())!
    const shown = (await toast(page).boundingBox())!
    expect(shown.y + shown.height).toBeLessThanOrEqual(bar.y + 1)
  })

  test('floats above the footer, on its own raised surface', async ({ page }) => {
    await page.goto('/')
    await drop(page, 'photo.png', Buffer.from([0x89, 0x50, 0x4E, 0x47]))
    await expect(toast(page)).toBeVisible({ timeout: 4000 })
    const footer = (await page.locator('footer').boundingBox())!
    const shown = (await toast(page).boundingBox())!
    expect(shown.y + shown.height).toBeLessThanOrEqual(footer.y - 24)
    const colours = await toast(page).evaluate(element => [getComputedStyle(element).backgroundColor, getComputedStyle(element).boxShadow])
    expect(colours[1]).not.toBe('none')
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } })
    test('spans the width, with a margin', async ({ page }) => {
      await page.goto('/')
      await drop(page, 'photo.png', Buffer.from([0x89, 0x50, 0x4E, 0x47]))
      const shown = (await toast(page).boundingBox())!
      expect(shown.x).toBe(16)
      expect(shown.width).toBe(390 - 32)
    })
  })
})

test.describe('the drop state', () => {
  const dragOver = (page: Page) => page.evaluate(() => {
    const data = new DataTransfer()
    data.items.add(new File(['x'], 'a.csv'))
    document.body.dispatchEvent(new DragEvent('dragenter', { dataTransfer: data, bubbles: true, cancelable: true }))
  })
  const dragAway = (page: Page) => page.evaluate(() => document.body.dispatchEvent(new DragEvent('dragleave', { bubbles: true })))

  test('appears while a file is over the page, on every step, and goes when it leaves', async ({ page }) => {
    await page.goto('/roadmap/')
    await dragOver(page)
    await expect(page.getByText('Drop to open. Nothing is uploaded.')).toBeVisible()
    await dragAway(page)
    await expect(page.getByTestId('drop-overlay')).toHaveCount(0)
  })

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })
    test('appears without moving', async ({ page }) => {
      await page.goto('/')
      await dragOver(page)
      const overlay = page.getByTestId('drop-overlay')
      await expect(overlay).toBeVisible()
      expect(await overlay.evaluate(element => getComputedStyle(element).transitionProperty)).toBe('none')
      expect(await overlay.locator('div').first().evaluate(element => getComputedStyle(element).transitionProperty)).toBe('none')
    })
  })
})

test('the German note reads in German', async ({ page }) => {
  await page.goto('/de/')
  await drop(page, 'interview.docx', docx())
  await expect(toast(page)).toContainText('Dokumente und Transkripte stehen auf der Roadmap. Derzeit liest Painfold CSV- und Excel-Dateien.')
  await expect(toast(page).getByRole('link', { name: 'Zur Roadmap' })).toHaveAttribute('href', '/de/roadmap/')
  await expect(toast(page).getByRole('button', { name: 'Schließen' })).toBeVisible()
})
