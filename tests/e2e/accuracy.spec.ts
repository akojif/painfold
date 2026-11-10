import { readFileSync } from 'node:fs'
import type { AccuracyData } from '../../scripts/eval'
import { expect, test } from './fixtures'

// The Accuracy page shows the eval output in data/eval/accuracy.json; the
// expected numbers here are computed from that file, so the test checks the
// page, not a copy of the numbers.
const data = JSON.parse(readFileSync(new URL('../../data/eval/accuracy.json', import.meta.url), 'utf8')) as AccuracyData
const both = (counts: { de: { found: number, labelled: number }, en: { found: number, labelled: number } }) => (counts.de.found + counts.en.found) / (counts.de.labelled + counts.en.labelled)
const percent = (share: number) => `${Math.round(share * 100)}%`
const groups = data.names.groups
const overall = groups.reduce((sum, group) => sum + data.names.removal[group]!.de.found + data.names.removal[group]!.en.found, 0) / data.names.total
const weakest = Math.min(...groups.map(group => both(data.names.removal[group]!)))

test('is prerendered and opens with one plain sentence', async ({ page, request }) => {
  const html = await (await request.get('/accuracy')).text()
  expect(html).toContain(`Out of 100 names in your feedback, Painfold removes about ${Math.round(overall * 100)}.`)
  await page.goto('/accuracy')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How well Painfold finds personal data')
  await expect(page).toHaveTitle('Accuracy, Painfold')
})

test('shows the findings and the Stage 2 status from the eval output', async ({ page }) => {
  await page.goto('/accuracy')
  const findings = page.getByRole('region', { name: 'In short' })
  await expect(findings).toContainText(`Names: ${percent(overall)} are removed in German and English feedback, and at least ${percent(weakest)} in every one of 13 name-origin groups.`)
  await expect(findings).toContainText(`${percent(both(data.sets['hard-cases'].any))} of the values in hand-written hard cases are removed.`)
  await expect(findings).toContainText(weakest >= data.target ? ': met.' : ': not met yet.')
})

test('lists every name-origin group with its removal recall, and marks none below the target that is not', async ({ page }) => {
  await page.goto('/accuracy')
  const list = page.getByRole('region', { name: 'By name-origin group' }).getByRole('listitem')
  await expect(list).toHaveCount(13)
  for (const group of groups) {
    const share = both(data.names.removal[group]!)
    const row = list.filter({ hasText: new RegExp(`^${{ 'german-speaking': 'German-speaking', 'english': 'English', 'bosnian-serbian-croatian': 'Bosnian, Serbian, Croatian', 'turkish': 'Turkish', 'romanian': 'Romanian', 'hungarian': 'Hungarian', 'polish': 'Polish', 'ukrainian': 'Ukrainian', 'arabic': 'Arabic', 'afghan': 'Afghan', 'african': 'African', 'south-asian': 'South Asian', 'east-asian': 'East Asian' }[group]}`) })
    await expect(row).toContainText(percent(share))
    if (share < data.target) await expect(row).toContainText('below target')
    else await expect(row).not.toContainText('below target')
  }
})

test('the language switch shows German or English alone', async ({ page }) => {
  await page.goto('/accuracy')
  const names = page.getByRole('region', { name: 'Names', exact: true })
  await expect(names).toContainText(`${data.names.total} test names`)
  await page.locator('label').filter({ hasText: 'German' }).click()
  const german = groups.reduce((sum, group) => sum + data.names.removal[group]!.de.labelled, 0)
  await expect(names).toContainText(`${german} test names`)
})

test('the generated set is collapsed, after the hard cases', async ({ page }) => {
  await page.goto('/accuracy')
  const details = page.locator('details')
  await expect(details).not.toHaveAttribute('open')
  await details.locator('summary').click()
  await expect(details.getByRole('table')).toBeVisible()
  await expect(details.getByRole('row').filter({ hasText: 'Email addresses' })).toBeVisible()
})

test('names the model, its license and the CoNLL caveat, and links to the method and data', async ({ page }) => {
  await page.goto('/accuracy')
  const model = page.getByRole('region', { name: 'The name model' })
  await expect(model).toContainText(data.model.original)
  await expect(model).toContainText(data.model.license)
  await expect(model).toContainText('CoNLL-2003')
  await expect(page.getByRole('link', { name: 'All numbers and the method' })).toHaveAttribute('href', /docs\/accuracy\.md$/)
})

test('the footer links to it, and the German page reads in German', async ({ page }) => {
  await page.goto('/')
  await page.locator('footer').getByRole('link', { name: 'Accuracy' }).click()
  await expect(page).toHaveURL(/\/accuracy$/)
  await page.goto('/de/accuracy')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wie gut Painfold personenbezogene Daten findet')
  await expect(page.getByText(`Von 100 Namen in Ihrem Feedback entfernt Painfold etwa ${Math.round(overall * 100)}.`)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Nach Herkunftsgruppe der Namen' })).toContainText('Deutschsprachig')
})

for (const width of [320, 390]) {
  test(`does not scroll sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    for (const path of ['/accuracy', '/de/accuracy']) {
      await page.goto(path)
      await page.locator('details summary').click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(width)
    }
  })
}
