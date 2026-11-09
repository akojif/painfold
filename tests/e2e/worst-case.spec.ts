import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Worst-case data for the review and download screens, entered through the
// real boundary: an imported file. All values are invented. Set
// WORST_CASE_SHOTS to a folder to also save screenshots of every state.
const LONG_HEADER = 'Freitext-Rückmeldung des Kunden (Pflichtfeld, max. 2000 Zeichen)'
const rows: string[][] = [
  ['ZD-4481920', 'Bitte alle Rechnungen an bartholomew.fitzgerald@northwind-industries-holdings.example.com schicken, nicht an mich.', 'aleksandra.wisniewska-kowalczyk@example.com'],
  ['ZD-4481921', 'Link aus dem Newsletter: https://support.northwind-industries-holdings.example.com/tickets/2026/09/ZD-4481920?utm_source=newsletter&utm_campaign=herbst-aktion-2026 geht nicht', ''],
  ['ZD-4481922', 'x', 'jo@example.com'],
  ['ZD-4481923', 'Перезвоните мне, пожалуйста: +43 660 234 2972. Спасибо!', ''],
  ['ZD-4481924', 'Vui lòng gọi lại cho tôi qua số +49 30 23125 417 hoặc gửi thư tới nguyễn.thị.hương@example.com 🙏', ''],
  ['ZD-4481925', 'IBAN AT61 1904 3002 3457 3201, Karte 5555 5555 5555 4444, UID ATU13585627, IP 192.0.2.7\nZweite Zeile: geboren am 12.03.1987, Lindengasse 5/2/7, 1070 Wien', ''],
  ['ZD-4481926', 'SV-Nummer 1237 010180 bitte ändern. Mail: bartholomew.fitzgerald@northwind-industries-holdings.example.com', ''],
  ['ZD-4481927', '', ''],
]
const csv = (header: string[], body: string[][]) => [header, ...body].map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
const FILES = {
  worst: { name: 'Kundenfeedback_Q3-2026_Export_Zendesk_alle_Kanäle_final_v12 (2).csv', text: csv(['ticket_id', LONG_HEADER, 'customer_email_address_primary_contact'], rows) },
  one: { name: 'one.csv', text: csv(['id', 'message'], [['1', 'Bitte an jo@example.com antworten, danke für die Hilfe']]) },
  empty: { name: 'empty.csv', text: csv(['id', 'message'], [['1', 'Alles gut, danke für die schnelle Hilfe!']]) },
  huge: { name: 'huge.csv', text: csv(['id', 'message'], Array.from({ length: 5000 }, (_, i) => [String(i + 1), `Kunde kunde.nummer.${i + 1}@example.com bittet um Rückruf unter +43 660 ${String(1000000 + i).slice(0, 3)} ${String(1000 + i).slice(-4)}`])) },
}
const out = process.env.WORST_CASE_SHOTS

async function open(page: Page, file: { name: string, text: string }) {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({ name: file.name, mimeType: 'text/csv', buffer: Buffer.from(file.text) })
  await page.getByRole('button', { name: /Find personal data/ }).click()
  await expect(page).toHaveURL(/\/review$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
// Text cut off with an ellipsis and no title or accessible name holding the full value.
const hiddenTruncation = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.truncate')]
  .filter(element => element.scrollWidth > element.clientWidth && !element.closest('[title], [aria-label]'))
  .map(element => element.textContent!.trim().slice(0, 60)))

for (const width of [1280, 390, 320]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    for (const [state, file] of Object.entries(FILES)) {
      test(`${state}: no sideways scroll on review (both views) and download`, async ({ page }) => {
        test.setTimeout(60_000)
        await open(page, file)
        const shot = async (name: string) => out && page.screenshot({ path: `${out}/${state}-${name}-${width}.png`, fullPage: state !== 'huge' })
        expect(await sideways(page), 'review by value').toBeLessThanOrEqual(0)
        expect(await hiddenTruncation(page), 'review by value').toEqual([])
        await shot('value')
        await page.getByRole('tab', { name: 'By row' }).click()
        expect(await sideways(page), 'review by row').toBeLessThanOrEqual(0)
        await shot('row')
        await page.getByRole('link', { name: 'Continue to download' }).last().click()
        await expect(page).toHaveURL(/\/download$/)
        expect(await sideways(page), 'download').toBeLessThanOrEqual(0)
        expect(await hiddenTruncation(page), 'download').toEqual([])
        await shot('download')
      })
    }
  })
}

test('every type and its bulk removal stay in view with thousands of values', async ({ page }) => {
  await open(page, FILES.huge)
  const values = page.getByRole('navigation', { name: 'Values found' })
  await expect(values.getByRole('heading')).toHaveText(['Email addresses', 'Phone numbers'])
  await expect(values.getByRole('button', { name: 'Remove all 5,000 phone numbers' })).toBeAttached()
  await expect(values.getByRole('button', { name: 'Show 100 more' })).toHaveCount(2)
})

test('a single finding is counted in the singular', async ({ page }) => {
  await open(page, FILES.one)
  await expect(page.getByRole('navigation', { name: 'Values found' }).getByRole('button', { name: 'Remove 1 email address' })).toHaveText('Remove 1')
})

test('with no findings, the panel does not ask to select one', async ({ page }) => {
  await open(page, FILES.empty)
  await expect(page.getByText('No findings.', { exact: false })).toBeVisible()
  await expect(page.getByText('Select a finding to review it.')).toHaveCount(0)
})

test('long file names and links keep their end visible, with the full text as a title', async ({ page }) => {
  await open(page, FILES.worst)
  await expect(page.locator(`main [title="${FILES.worst.name}"]`)).toContainText('final_v12 (2).csv')
  const link = page.locator('[title^="https://support.northwind"]')
  await expect(link).toContainText('herbst-aktion-2026')
})

test.describe('at 320px', () => {
  test.use({ viewport: { width: 320, height: 900 } })

  test('the header and the stepper stay on one line each', async ({ page }) => {
    await open(page, FILES.worst)
    const lineHeight = (locator: import('@playwright/test').Locator) => locator.evaluate(element => element.getBoundingClientRect().height)
    expect(await lineHeight(page.getByRole('button', { name: /What leaves your browser/ }))).toBeLessThan(40)
    expect(await lineHeight(page.getByRole('navigation', { name: 'Steps' }).locator('ol'))).toBeLessThan(30)
  })

  test('punctuation after a finding stays on the line of the finding', async ({ page }) => {
    await open(page, FILES.worst)
    await page.getByRole('tab', { name: 'By row' }).click()
    const lineStarts = await page.locator('main ol > li').filter({ hasText: 'Row 6' }).locator('p').last().evaluate((element) => {
      const range = document.createRange()
      const starts: string[] = []
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let previousTop = -1
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (let i = 0; i < node.textContent!.length; i++) {
          range.setStart(node, i)
          range.setEnd(node, i + 1)
          const top = Math.round(range.getBoundingClientRect().top)
          if (top > previousTop + 4 && node.textContent![i]!.trim()) starts.push(node.textContent![i]!)
          if (node.textContent![i]!.trim()) previousTop = Math.max(previousTop, top)
        }
      }
      return starts
    })
    for (const start of lineStarts) expect(',.;:').not.toContain(start)
  })
})

// The column step, with files that have too many, too long, empty and oddly named columns.
const wideHeader = [
  'Freitext-Rückmeldung des Kunden (Pflichtfeld, max. 2000 Zeichen)',
  'customer_email_address_primary_contact',
  'Телефон клиента',
  'x',
  'Rückrufnummer',
  'notes',
  ...Array.from({ length: 54 }, (_, i) => `custom_field_${String(i + 1).padStart(2, '0')}_${['segment', 'plan', 'region', 'channel'][i % 4]}`),
]
const wideRow = (i: number) => [
  `Der Export nach DATEV bricht seit dem Update nach genau 90 Tagen ab, Ticket ${i}`,
  `bartholomew.fitzgerald${i}@northwind-industries-holdings.example.com`,
  `Позвоните мне ${i}`,
  i % 2 ? 'y' : 'n',
  ['+43 660 234 2972', '5555 5555 5555 4444', '192.0.2.7'][i % 3]!,
  '',
  ...Array.from({ length: 54 }, (_, j) => (j % 9 === 0 ? '' : j % 5 === 0 ? 'https://support.northwind-industries-holdings.example.com/tickets/2026/09/ZD-4481920' : `Wert ${j}`)),
]
const COLUMN_FILES = {
  wide: { name: 'Kundenfeedback_Q3-2026_Export_Zendesk_alle_Kanäle_final_v12 (2).csv', text: csv(wideHeader, Array.from({ length: 6 }, (_, i) => wideRow(i + 1))) },
  single: { name: 'single.csv', text: csv(['Feedback'], [['Bitte die Rechnungen als PDF anhängen, danke!'], ['Export dauert zu lange']]) },
  noGuess: { name: 'short.csv', text: csv(['code', 'tag'], [['A1', 'ok'], ['B2', 'slow']]) },
  big: { name: 'big.csv', text: csv(['message', 'ref', ...Array.from({ length: 10 }, (_, i) => `field_${i}`)], Array.from({ length: 5000 }, (_, i) => [`Bitte um Rückruf wegen Rechnung ${i}`, `+43 660 ${String(1000000 + i).slice(-7)}`, ...Array.from({ length: 10 }, (_, j) => `Wert ${j}`)])) },
}

async function openColumns(page: Page, file: { name: string, text: string }) {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({ name: file.name, mimeType: 'text/csv', buffer: Buffer.from(file.text) })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose what to check')
}

for (const width of [1280, 390, 320]) {
  test.describe(`column step at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    for (const [state, file] of Object.entries(COLUMN_FILES)) {
      test(`${state}: no sideways scroll, nothing cut off without a title`, async ({ page }) => {
        test.setTimeout(60_000)
        await openColumns(page, file)
        await page.waitForTimeout(state === 'big' ? 3000 : 500)
        expect(await sideways(page), 'columns').toBeLessThanOrEqual(0)
        expect(await hiddenTruncation(page), 'columns').toEqual([])
        if (out) await page.screenshot({ path: `${out}/columns-${state}-${width}.png`, fullPage: true })
        await page.getByText(/Show first \d rows?/).click()
        expect(await sideways(page), 'preview').toBeLessThanOrEqual(0)
        if (out) await page.screenshot({ path: `${out}/columns-${state}-preview-${width}.png`, fullPage: true })
      })
    }
  })
}

test('the survey of 5,000 rows and 12 columns finishes quickly and flags the kept phone column', async ({ page }) => {
  await openColumns(page, COLUMN_FILES.big)
  const started = Date.now()
  await expect(page.getByText('Contains 5,000 phone numbers.')).toBeVisible({ timeout: 20_000 })
  expect(Date.now() - started).toBeLessThan(5_000)
})

test('sentences win the feedback guess over a column of long links', async ({ page }) => {
  await openColumns(page, COLUMN_FILES.wide)
  await expect(page.getByRole('radio', { name: `Use ${wideHeader[0]} as the feedback column` })).toBeChecked()
})

test('with no feedback column guessed, the choice is visible and explained', async ({ page }) => {
  await openColumns(page, COLUMN_FILES.noGuess)
  await expect(page.getByText('No column looks like feedback.', { exact: false })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Use code as the feedback column' })).toHaveCSS('opacity', '1')
  await page.getByRole('radio', { name: 'Use tag as the feedback column' }).check()
  await expect(page.getByText('No column looks like feedback.', { exact: false })).toHaveCount(0)
})

test('long column names wrap after separators, not mid-word', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openColumns(page, COLUMN_FILES.wide)
  const name = page.getByRole('region', { name: 'Columns' }).locator(':scope > ul > li p:first-child').filter({ hasText: /^custom_field_05_segment$/ })
  await expect(name).toHaveText('custom_field_05_segment')
  // The character before each line break, found from where each character is drawn.
  const beforeBreaks = await name.evaluate((element) => {
    const range = document.createRange()
    const characters: Array<{ character: string, top: number }> = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (let i = 0; i < node.textContent!.length; i++) {
        range.setStart(node, i)
        range.setEnd(node, i + 1)
        characters.push({ character: node.textContent![i]!, top: Math.round(range.getBoundingClientRect().top) })
      }
    }
    return characters.flatMap((current, i) => (i > 0 && current.top > characters[i - 1]!.top + 4 ? [characters[i - 1]!.character] : []))
  })
  expect(beforeBreaks.length).toBeGreaterThan(0)
  for (const character of beforeBreaks) expect('_-./').toContain(character)
})
