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
  expect(html).toContain('Here is what is released, what is being built and what comes after.')

  await page.goto('/')
  await page.locator('footer').getByRole('link', { name: 'Roadmap' }).click()
  await expect(page).toHaveURL(/\/roadmap\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap')
  await expect(page.getByText('Current version: v0.3.0. 1 in progress, 7 planned, and 2 ideas.')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([/^Released/, /^Now/, /^Next/, /^Later/, /^Ideas/])

  // The releases, newest first; with three, there is nothing more to show.
  await expect(page.locator('#roadmap-releases > li h3')).toHaveText([/v0\.3\.0\s*Jobs, pains and gains/, /v0\.2\.0\s*Names/, /v0\.1\.0\s*Clean/])
  await expect(page.getByRole('link', { name: 'Release v0.3.0 (opens in a new tab)' })).toHaveAttribute('href', 'https://github.com/akojif/painfold/releases/tag/v0.3.0')
  await expect(page.getByRole('button', { name: /All releases/ })).toHaveCount(0)

  // Now carries the current work; Later shows four cards, the other two on request.
  const now = page.getByRole('region', { name: /^Now/ })
  await expect(now.getByRole('heading', { level: 3 })).toHaveText(['Workspace redesign'])
  await expect(now.getByRole('link', { name: 'Issue #141 (opens in a new tab)' })).toHaveAttribute('target', '_blank')
  const later = page.getByRole('region', { name: /^Later/ })
  await expect(later.getByRole('listitem')).toHaveCount(4)
  const more = later.getByRole('button', { name: 'Show 2 more' })
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await more.click()
  await expect(later.getByRole('listitem')).toHaveCount(6)
  await expect(later.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true')

  // Later and Ideas show a first line, and the rest in place.
  const engine = page.getByRole('region', { name: /^Ideas/ }).getByRole('listitem').first()
  const toggle = engine.getByRole('button', { name: /^More\s*:\s*Painfold Engine$/ })
  await toggle.click()
  await expect(engine.getByRole('button', { name: /^Less\s*:\s*Painfold Engine$/ })).toHaveAttribute('aria-expanded', 'true')

  await expect(page.getByRole('link', { name: 'Read the full roadmap on GitHub' })).toHaveAttribute('href', 'https://github.com/akojif/painfold/blob/main/ROADMAP.md')
  await expect(page.getByRole('navigation', { name: 'Steps' })).toHaveCount(0)
  const source = page.locator('footer').getByRole('link', { name: 'Open source' })
  await expect(source).toHaveAttribute('href', 'https://github.com/akojif/painfold')
  await expect(source.locator('svg')).toHaveCount(1)
})

test('the German roadmap reads in German', async ({ page }) => {
  await page.goto('/de/roadmap/')
  await expect(page.getByText('Aktuelle Version: v0.3.0. 1 in Arbeit, 7 geplant und 2 Ideen.')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([/^Veröffentlicht/, /^Jetzt/, /^Als Nächstes/, /^Später/, /^Ideen/])
  await expect(page.getByRole('button', { name: '2 weitere zeigen' })).toBeVisible()
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

  test('the roadmap and the footer do not scroll sideways, with the columns stacked in order', async ({ page }) => {
    for (const path of ['/roadmap/', '/de/roadmap/']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap')
      const tops = await page.getByRole('heading', { level: 2 }).evaluateAll(headings => headings.map(heading => heading.getBoundingClientRect().top))
      expect(tops, path).toEqual([...tops].sort((a, b) => a - b))
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0)
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
