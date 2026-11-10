import { expect, test } from './fixtures'

test('the footer credits the author in a new tab, without a heart or emoji', async ({ page }) => {
  await page.goto('/')
  const footer = page.locator('footer')
  await expect(footer).toContainText('Built with love by Francis Akoji')
  const link = footer.getByRole('link', { name: 'Francis Akoji' })
  await expect(link).toHaveAttribute('href', 'https://francisakoji.com')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener')
  expect(await footer.innerText()).not.toMatch(/\p{Extended_Pictographic}/u)
})

test('the roadmap page is prerendered and lists every stage with the current one marked', async ({ page, request }) => {
  const html = await (await request.get('/roadmap')).text()
  expect(html).toContain('Cleaning your feedback privately is the first step.')

  await page.goto('/')
  await page.locator('footer').getByRole('link', { name: 'Roadmap' }).click()
  await expect(page).toHaveURL(/\/roadmap$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap')
  const stages = page.getByRole('list', { name: 'Stages' }).locator(':scope > li')
  await expect(stages.getByRole('heading', { level: 2 })).toHaveText(['v0.1 Clean', 'v0.2 Names', 'v0.3 Jobs, pains and gains', 'v0.4 Report', 'v0.5 Transcripts and documents', 'v1.0 Launch'])
  await expect(stages.first()).toContainText('Available')
  await expect(stages.nth(1)).toHaveAttribute('aria-current', 'step')
  await expect(stages.nth(1)).toContainText('Current stage')
  await expect(stages.nth(1)).toContainText('In progress')
  await expect(stages.nth(2)).toContainText('Next')
  await expect(stages.nth(3)).toContainText('Planned')
  await expect(page.getByRole('link', { name: 'Read the full roadmap on GitHub' })).toHaveAttribute('href', 'https://github.com/akojif/painfold/blob/main/ROADMAP.md')
  await expect(page.getByRole('navigation', { name: 'Steps' })).toHaveCount(0)
  await expect(page.locator('footer').getByRole('list', { name: 'About Painfold' }).getByRole('listitem')).toHaveText(['Your file is never uploaded. It stays in this browser.', 'No cookies', 'No account'])
  const source = page.locator('footer').getByRole('link', { name: 'Open source' })
  await expect(source).toHaveAttribute('href', 'https://github.com/akojif/painfold')
  await expect(source.locator('svg')).toHaveCount(1)
})

test('the download step links to the roadmap page and back keeps the cleaned file', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the sample file' }).click()
  await page.getByRole('button', { name: /Find personal data/ }).click()
  await page.getByRole('link', { name: 'Continue to download' }).last().click()
  await page.getByRole('link', { name: 'See the roadmap' }).click()
  await expect(page).toHaveURL(/\/roadmap$/)
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your cleaned file is ready.')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the roadmap and the footer do not scroll sideways', async ({ page }) => {
    await page.goto('/roadmap')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
})
