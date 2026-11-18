import { expect, openSample, test } from './fixtures'

test('the footer credits the author in a new tab, announced as one, without a heart or emoji', async ({ page }) => {
  await page.goto('/')
  const footer = page.locator('footer')
  await expect(footer.getByText('Built by')).toHaveText('Built by Francis Akoji (opens in a new tab)')
  const link = footer.getByRole('link', { name: 'Francis Akoji (opens in a new tab)' })
  await expect(link).toHaveAttribute('href', 'https://francisakoji.com')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener')
  expect(await footer.innerText()).not.toMatch(/\p{Extended_Pictographic}/u)
})

test('the roadmap page is prerendered and shows what is released, what is being built and what comes after', async ({ page, request }) => {
  const html = await (await request.get('/roadmap/')).text()
  expect(html).toContain('Cleaning your feedback privately is the first step.')

  await page.goto('/')
  await page.locator('footer').getByRole('link', { name: 'Roadmap' }).click()
  await expect(page).toHaveURL(/\/roadmap\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Released', 'Now', 'Next', 'Later', 'Ideas'])
  await expect(page.getByText('You are here: v0.3.0')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Release v0.3.0 (opens in a new tab)' })).toHaveAttribute('href', 'https://github.com/akojif/painfold/releases/tag/v0.3.0')
  await expect(page.getByRole('link', { name: 'Issue #141 (opens in a new tab)' })).toHaveAttribute('target', '_blank')
  await expect(page.getByRole('link', { name: 'Read the full roadmap on GitHub' })).toHaveAttribute('href', 'https://github.com/akojif/painfold/blob/main/ROADMAP.md')
  await expect(page.getByRole('navigation', { name: 'Steps' })).toHaveCount(0)
  const source = page.locator('footer').getByRole('link', { name: 'Open source' })
  await expect(source).toHaveAttribute('href', 'https://github.com/akojif/painfold')
  await expect(source.locator('svg')).toHaveCount(1)
})

// Prototype only (proto/roadmap): the switcher between the three variations.
test('the variation switcher swaps the page and keeps the choice in the address', async ({ page }) => {
  await page.goto('/de/roadmap/?variant=c')
  const switcher = page.getByRole('group', { name: 'Roadmap-Variante' })
  await expect(switcher.locator('[aria-pressed="true"]')).toHaveText('c')
  await expect(page.getByRole('group', { name: 'Anzeigen' })).toBeVisible()
  await switcher.getByRole('button', { name: /^B:/ }).click()
  await expect(page).toHaveURL(/\/de\/roadmap\/\?variant=b$/)
  await expect(page.getByRole('heading', { level: 2, name: /^Jetzt/ })).toBeVisible()
  await page.reload()
  await expect(switcher.locator('[aria-pressed="true"]')).toHaveText('b')
})

test('the download page leads on to Analyze, and going back keeps the cleaned file', async ({ page }) => {
  await page.goto('/')
  await openSample(page)
  await page.getByRole('button', { name: /Find personal data/ }).click()
  await page.getByRole('link', { name: 'Download the cleaned file' }).last().click()
  await page.getByRole('link', { name: 'Continue to analyze' }).click()
  await expect(page).toHaveURL(/\/analyze\/$/)
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your cleaned file is ready.')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the roadmap and the footer do not scroll sideways, in every variation', async ({ page }) => {
    for (const variant of ['a', 'b', 'c']) {
      await page.goto(`/roadmap/?variant=${variant}`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap')
      await expect(page.getByRole('group', { name: 'Roadmap variation' }).locator('[aria-pressed="true"]')).toHaveText(variant)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), variant).toBeLessThanOrEqual(0)
    }
  })
})

test('no link or button anywhere ends in an arrow', async ({ page }) => {
  for (const path of ['/', '/roadmap/', '/de/', '/does-not-exist']) {
    await page.goto(path)
    const arrows = await page.locator('a, button').evaluateAll(elements => elements.filter(element => /[→↗➜]/.test(element.textContent ?? '') || element.querySelector('svg path[d*="h10m-3.5"], svg path[d*="L13 8"]')).length)
    expect(arrows, path).toBe(0)
  }
})

test('the German footer credit and the new-tab hint read in German', async ({ page }) => {
  await page.goto('/de/')
  await expect(page.locator('footer').getByRole('link', { name: 'Francis Akoji (öffnet in neuem Tab)' })).toBeVisible()
  await expect(page.locator('footer').getByText('Entwickelt von')).toBeVisible()
})
