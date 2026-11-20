import { connectAnthropic, expect, openSample, test } from './fixtures'

// The workspace shell (#141): the top bar with the four steps on every step of
// the working flow once a file is open, and the footer below.

test('the top bar shows the steps as links once they can be reached, with what each holds', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Steps' })).toHaveCount(0)
  await openSample(page)
  const steps = page.getByRole('navigation', { name: 'Steps' })
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/Import/)
  // Nothing reviewed yet: only Import is there, and it is the current step, not a link.
  await expect(steps.getByRole('link')).toHaveCount(0)

  await page.getByRole('button', { name: /Find personal data/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/findings in 200 rows/)
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/^\s*Review,\s*\d+ left$/)
  await expect(steps.getByRole('link')).toHaveText(['Import, done', 'Analyze'])
  await expect(page.locator('header').getByRole('button', { name: 'Start over' })).toBeVisible()
  await expect(page.locator('footer').getByRole('link', { name: 'Roadmap' })).toBeVisible()

  // Back to the column step from the steps, with the review kept.
  await steps.getByRole('link', { name: /Import/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/Import/)

  // Steps reached from the top bar show at once, never the empty page a direct visit gets first (#172).
  await steps.getByRole('link', { name: /Review/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/findings in 200 rows/)
  await steps.getByRole('link', { name: /Analyze/ }).click()
  await expect(page).toHaveURL(/\/analyze\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Where should the analysis run?')
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/Analyze/)
})

test('the steps read in German', async ({ page }) => {
  await page.goto('/de/')
  await openSample(page)
  await page.getByRole('button', { name: /^Personenbezogene Daten in .+ finden$/ }).click()
  const steps = page.getByRole('navigation', { name: 'Schritte' })
  await expect(steps.getByRole('listitem')).toHaveText([/Importieren/, /Prüfen/, /Analysieren/, /Bericht/])
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/^\s*Prüfen,\s*\d+ offen$/)
  await expect(page.locator('header').getByRole('button', { name: 'Neu beginnen' })).toBeVisible()
})

test('Import: the sidebar holds the file and where the rules found personal data', async ({ page }) => {
  await page.goto('/')
  await openSample(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose what to check')
  const sidebar = page.getByRole('complementary', { name: 'File and columns' })
  await expect(sidebar.getByRole('heading', { level: 2 })).toHaveText(['File', 'Personal data by column'])
  await expect(sidebar.getByTitle('support-tickets.csv', { exact: true })).toBeVisible()
  await expect(sidebar.locator('dl > div')).toHaveText([/^Rows\s*200$/, /^Columns\s*9$/])
  await expect(sidebar.getByText('Sample file with fake data.')).toBeVisible()
  // Most personal data first, with what happens to the column when it is not checked.
  const columns = sidebar.getByRole('listitem')
  await expect(columns.first()).toHaveText(/^customer_email\s*Drop\s*200$/)
  await expect(columns.filter({ hasText: 'message' })).toHaveText(/^message\s*\d+$/)
  await expect(page.getByRole('button', { name: 'Find personal data in 200 rows' })).toBeVisible()
})

test.describe('Import at 768 px', () => {
  test.use({ viewport: { width: 768, height: 900 } })

  test('the sidebar comes first, and nothing scrolls sideways, in English and German', async ({ page }) => {
    for (const [path, sidebarName] of [['/', 'File and columns'], ['/de/', 'Datei und Spalten']] as const) {
      await page.goto(path)
      await openSample(page)
      const sidebar = page.getByRole('complementary', { name: sidebarName })
      const top = async (locator: import('@playwright/test').Locator) => (await locator.boundingBox())!.y
      expect(await top(sidebar)).toBeLessThan(await top(page.getByRole('heading', { level: 1 })))
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0)
      await page.locator('header').getByRole('button', { name: /^(Start over|Neu beginnen)$/ }).click()
      const dialog = page.getByRole('dialog')
      if (await dialog.isVisible().catch(() => false)) await dialog.getByRole('button', { name: /^(Start over|Neu beginnen)$/ }).click()
    }
  })
})

// Review (#141): the table of values, its filters and the drawer.
const reviewCsv = [
  'id,message',
  '1,"Bitte an anna@example.com schreiben, danke."',
  '2,"Nochmal: anna@example.com, bitte rasch antworten"',
  '3,"Unser Server 192.0.2.7 meldet seit gestern Fehler"',
].join('\n')
async function openReviewTable(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({ name: 'tickets.csv', mimeType: 'text/csv', buffer: Buffer.from(reviewCsv) })
  await page.getByRole('button', { name: /Find personal data/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
}
const valueButtons = (page: import('@playwright/test').Page) => page.getByRole('tabpanel', { name: 'By value' }).locator('[data-value]')

test('Review: sorting a column reorders the table, and N follows the new order', async ({ page }) => {
  await openReviewTable(page)
  await expect(valueButtons(page)).toHaveText(['anna@example.com', '192.0.2.7'])
  await page.getByRole('button', { name: 'Rows', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'Rows' })).toHaveAttribute('aria-sort', 'descending')
  await page.getByRole('button', { name: 'Rows', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'Rows' })).toHaveAttribute('aria-sort', 'ascending')
  await expect(valueButtons(page)).toHaveText(['192.0.2.7', 'anna@example.com'])
  await valueButtons(page).first().click()
  await page.keyboard.press('n')
  await expect(page.locator('[data-value][aria-current="true"]')).toHaveText('anna@example.com')
})

test.describe('Review at 1,024 px', () => {
  test.use({ viewport: { width: 1024, height: 900 } })

  test('the drawer opens only when a value is chosen, over the table, and Escape closes it', async ({ page }) => {
    await openReviewTable(page)
    const drawer = page.getByRole('region', { name: 'Email address' })
    await expect(drawer).toHaveCount(0)
    await valueButtons(page).first().click()
    await expect(drawer).toBeVisible()
    await expect(drawer).toContainText('Where it appears')
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
})

test.describe('Review at 768 px', () => {
  test.use({ viewport: { width: 768, height: 900 } })

  test('there is no drawer: the note is the bar at the bottom, and nothing scrolls sideways', async ({ page }) => {
    await openReviewTable(page)
    await valueButtons(page).first().click()
    await expect(page.getByRole('region', { name: 'Email address' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Remove R' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Where it appears' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
  test('the filters start collapsed to one row, open on request, and say how many are active (#185)', async ({ page }) => {
    await openReviewTable(page)
    const type = page.getByRole('group', { name: 'Type' })
    const toggle = page.getByRole('button', { name: 'Show filters' })
    await expect(type).toBeHidden()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // The table starts right below the collapsed row: its first values are in view.
    await expect(valueButtons(page).first()).toBeInViewport()

    await toggle.click()
    await expect(page.getByRole('button', { name: 'Hide filters' })).toHaveAttribute('aria-expanded', 'true')
    await type.getByRole('checkbox', { name: /^Email addresses/ }).check()
    await page.getByRole('button', { name: 'Hide filters' }).click()
    await expect(type).toBeHidden()
    // Collapsed, the heading still says a filter is on, and Clear filters stays at hand.
    await expect(page.getByRole('heading', { name: 'Filters, 1 active' })).toBeVisible()
    await expect(valueButtons(page)).toHaveText(['anna@example.com'])
    await page.getByRole('button', { name: 'Clear filters' }).first().click()
    await expect(page.getByRole('heading', { name: 'Filters', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })

  test('in German, the toggle reads in German and nothing scrolls sideways', async ({ page }) => {
    await openReviewTable(page)
    await page.getByRole('button', { name: 'German' }).click()
    await page.getByRole('button', { name: 'Filter anzeigen' }).click()
    await expect(page.getByRole('group', { name: 'Art' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Filter ausblenden' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
})

test('from 1,024 px the filters are always open, with no toggle', async ({ page }) => {
  await openReviewTable(page)
  await expect(page.getByRole('group', { name: 'Type' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Show|Hide) filters$/ })).toHaveCount(0)
})

test('Review by row: the tab bar says how many rows are listed', async ({ page }) => {
  await openReviewTable(page)
  await page.getByRole('tab', { name: 'By row' }).click()
  await expect(page.getByText('3 rows', { exact: true })).toBeVisible()
  await expect(page.getByRole('tabpanel', { name: 'By row' }).locator('ol > li')).toHaveCount(3)
})

test('Download: the sidebar holds the file and what the cleaned file contains', async ({ page }) => {
  await openReviewTable(page)
  await page.getByRole('link', { name: 'Download the cleaned file' }).first().click()
  await expect(page).toHaveURL(/\/download\/$/)
  const sidebar = page.getByRole('complementary', { name: 'The file and what it contains' })
  await expect(sidebar.getByTitle('tickets.csv', { exact: true })).toBeVisible()
  await expect(sidebar.locator('dl > div')).toHaveText([/^Rows\s*3$/])
  await expect(sidebar).toContainText('Automatic detection can miss personal data.')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your cleaned file is ready.')
  await sidebar.getByRole('link', { name: 'Back to review' }).click()
  await expect(page).toHaveURL(/\/review\/$/)
})

test.describe('Download at 768 px', () => {
  test.use({ viewport: { width: 768, height: 900 } })

  test('the sidebar comes first, and nothing scrolls sideways', async ({ page }) => {
    await openReviewTable(page)
    await page.getByRole('link', { name: 'Download the cleaned file' }).first().click()
    const sidebar = page.getByRole('complementary', { name: 'The file and what it contains' })
    expect((await sidebar.boundingBox())!.y).toBeLessThan((await page.getByRole('heading', { level: 1 }).boundingBox())!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
})

test.describe('Analyze in two steps', () => {
  test.use({ allowedOrigins: ['https://api.anthropic.com', 'http://localhost:11434'] })

  test('first where it runs, then what is sent, once the connection test works', async ({ page }) => {
    await openReviewTable(page)
    await page.getByRole('link', { name: 'Continue to analyze' }).last().click()
    await expect(page).toHaveURL(/\/analyze\/$/)
    const sidebar = page.getByRole('complementary', { name: 'On this page' })
    await expect(sidebar).toContainText('Not set up yet')
    await expect(sidebar).toContainText('After a successful connection test')
    // The privacy notice is in view before anything is set up.
    await expect(sidebar).toContainText('Only the cleaned text you approve is sent to the AI you choose.')
    await expect(page.getByRole('heading', { name: 'What will be sent' })).toHaveCount(0)

    await connectAnthropic(page)
    await expect(page.getByRole('heading', { name: 'What will be sent' })).toBeVisible()
    await expect(sidebar).toContainText('Claude Haiku 5.5')
    await expect(sidebar).not.toContainText('After a successful connection test')

    // The texts sent are one click away, in a panel on the right; Escape closes it and focus returns.
    const button = page.getByRole('button', { name: 'Review what will be sent (3 texts)' })
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await button.click()
    const panel = page.getByRole('region', { name: 'The texts that will be sent' })
    await expect(panel.getByRole('heading', { name: 'The texts that will be sent' })).toBeFocused()
    await expect(panel.getByRole('listitem')).toHaveCount(3)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(button).toBeFocused()
  })

  test('once connected, the settings are locked in a summary, with Change and Disconnect', async ({ page }) => {
    await openReviewTable(page)
    await page.getByRole('link', { name: 'Continue to analyze' }).last().click()
    await page.getByLabel('Remember on this device').check()
    await connectAnthropic(page, 'sk-ant-invented-key-9z8y')
    const connected = page.getByRole('region', { name: 'Connected' })
    await expect(connected).toBeFocused()
    await expect(connected).toContainText('Anthropic, Claude Haiku 5.5')
    await expect(connected).toContainText('Ending in 9z8y, remembered on this device')
    await expect(page.getByLabel('API key', { exact: true })).toHaveCount(0)

    // Change: the settings come back as they were, and sending waits for a new test.
    await connected.getByRole('button', { name: 'Change' }).click()
    await expect(page.getByLabel('API key', { exact: true })).toHaveValue('sk-ant-invented-key-9z8y')
    await expect(page.getByRole('heading', { name: 'What will be sent' })).toHaveCount(0)

    // Disconnect: the key is forgotten, here and on this device.
    await connectAnthropic(page, 'sk-ant-invented-key-9z8y')
    await page.getByRole('region', { name: 'Connected' }).getByRole('button', { name: 'Disconnect' }).click()
    await expect(page.getByLabel('API key', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Remember on this device')).not.toBeChecked()
    expect(await page.evaluate(() => localStorage.getItem('painfold.anthropic-key'))).toBeNull()
  })
})
