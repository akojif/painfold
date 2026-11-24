import { readFileSync } from 'node:fs'
import { addRates, publishedAnalysis } from '../../app/utils/analysis-accuracy'
import type { AnalysisResults } from '../../scripts/analysis-results'
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
  const html = await (await request.get('/accuracy/')).text()
  expect(html).toContain(`Out of 100 names in your feedback, Painfold removes about ${Math.round(overall * 100)}.`)
  await page.goto('/accuracy/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How well Painfold finds personal data')
  await expect(page).toHaveTitle('Accuracy, Painfold')
})

test('shows the findings and the Stage 2 status from the eval output', async ({ page }) => {
  await page.goto('/accuracy/')
  const findings = page.getByRole('region', { name: 'In short' })
  await expect(findings).toContainText(`Names: ${percent(overall)} are removed in German and English feedback, and at least ${percent(weakest)} in every one of 13 name-origin groups.`)
  await expect(findings).toContainText(`${percent(both(data.sets['hard-cases'].any))} of the values in the hard cases written for the tests are removed.`)
  await expect(findings).toContainText(weakest >= data.target ? ': met.' : ': not met yet.')
})

test('lists every name-origin group with its removal recall, and marks none below the target that is not', async ({ page }) => {
  await page.goto('/accuracy/')
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

test('the removal bar says in words when it is below the target, not by colour alone', async ({ page }) => {
  await page.goto('/accuracy/')
  const removal = page.getByRole('term').filter({ hasText: /^Removed/ }).first()
  if (overall < data.target) await expect(removal).toContainText('below target')
  else await expect(removal).toHaveText('Removed')
  // Every bar on the page is decoration beside a written number.
  for (const bar of await page.locator('main svg[data-value]').all()) await expect(bar).toHaveAttribute('aria-hidden', 'true')
})

test('the language switch shows German or English alone', async ({ page }) => {
  await page.goto('/accuracy/')
  const names = page.getByRole('region', { name: 'Names', exact: true })
  await expect(names).toContainText(`${data.names.total} test names`)
  await page.locator('label').filter({ hasText: 'German' }).click()
  const german = groups.reduce((sum, group) => sum + data.names.removal[group]!.de.labelled, 0)
  await expect(names).toContainText(`${german} test names`)
})

test('the target is marked only across both languages, where it applies', async ({ page }) => {
  await page.goto('/accuracy/')
  const english = page.locator('#groups').locator('xpath=ancestor::section').locator('li').filter({ hasText: /^English/ })
  await page.locator('label').filter({ hasText: /^\s*English\s*$/ }).click()
  // English names in English sentences: 11 of 13, shown, but not judged against the target.
  const { found, labelled } = data.names.removal.english!.en
  await expect(english).toContainText(percent(found / labelled))
  await expect(page.getByText('below target')).toHaveCount(0)
  await expect(page.getByText('The target applies to each group across both languages.')).toBeVisible()
})

test('the generated set is collapsed, after the hard cases', async ({ page }) => {
  await page.goto('/accuracy/')
  const details = page.locator('details')
  await expect(details).not.toHaveAttribute('open')
  await details.locator('summary').click()
  await expect(details.getByRole('table')).toBeVisible()
  await expect(details.getByRole('row').filter({ hasText: 'Email addresses' })).toBeVisible()
})

test('names the model, its license and the CoNLL caveat, and links to the method and data', async ({ page }) => {
  await page.goto('/accuracy/')
  const model = page.getByRole('region', { name: 'The name model' })
  await expect(model).toContainText(data.model.original)
  await expect(model).toContainText(data.model.license)
  await expect(model).toContainText('CoNLL-2003')
  await expect(page.getByRole('link', { name: 'All numbers and the method' })).toHaveAttribute('href', /docs\/accuracy\.md$/)
})

test('the footer links to it, and the German page reads in German', async ({ page }) => {
  await page.goto('/')
  await page.locator('footer').getByRole('link', { name: 'Accuracy' }).click()
  await expect(page).toHaveURL(/\/accuracy\/$/)
  await page.goto('/de/accuracy/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wie gut Painfold personenbezogene Daten findet')
  await expect(page.getByText(`Von 100 Namen in Ihrem Feedback entfernt Painfold etwa ${Math.round(overall * 100)}.`)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Nach Herkunftsgruppe der Namen' })).toContainText('Deutschsprachig')
})

// The analysis evaluation (#129): published once a test run is scored and mapped.
const analysis = publishedAnalysis(JSON.parse(readFileSync(new URL('../../data/eval/analysis/results.json', import.meta.url), 'utf8')) as AnalysisResults)
const analysisRuns = Object.values(analysis.runs)

test('shows how well jobs, pains and gains are found, or that they are not measured yet', async ({ page }) => {
  for (const [path, name, empty] of [
    ['/accuracy/', 'Jobs, pains and gains', 'Not measured yet. The numbers appear here before version 0.3.0 is released.'],
    ['/de/accuracy/', 'Aufgaben, Probleme und Wünsche', 'Noch nicht gemessen. Die Zahlen stehen hier, bevor Version 0.3.0 erscheint.'],
  ] as const) {
    await page.goto(path)
    const section = page.getByRole('region', { name, exact: true })
    if (analysisRuns.length === 0) {
      await expect(section).toContainText(empty)
      continue
    }
    const pains = addRates(analysisRuns.map(run => run.scores.tags.pains.recall))
    if (path === '/accuracy/') await expect(section).toContainText(`Out of 100 pains customers mention, Painfold finds about ${Math.round(pains.hits / pains.of * 100)}.`)
    await expect(section.getByRole('table')).toHaveCount(2)
    // The known weaknesses are published with the numbers, in the page's language.
    await expect(section.getByRole('heading', { name: path === '/accuracy/' ? 'Known weaknesses' : 'Bekannte Schwächen', exact: true })).toBeVisible()
    await expect(section.getByRole('listitem').first()).toContainText(path === '/accuracy/' ? 'Gains are the weakest kind.' : 'Wünsche sind die schwächste Art.')
    // Who wrote the texts, and what follows from it: stated next to the numbers.
    const english = path === '/accuracy/'
    await expect(section).toContainText(english ? 'The texts were written by a Claude model (Claude Opus 5.5) during development' : 'Die Texte hat ein Claude-Modell (Claude Opus 5.5) während der Entwicklung geschrieben')
    await expect(section.getByRole('listitem').filter({ hasText: english ? 'The texts are synthetic' : 'Die Texte sind synthetisch' })).toContainText(english ? 'likely make the scores optimistic' : 'wahrscheinlich zu günstig')
  }
})

test('says who wrote the personal-data test texts, and lists the gap that follows, in English and German', async ({ page }) => {
  for (const [path, source, gap] of [
    ['/accuracy/', 'were written by a Claude model (Claude Opus 5.5) during development, in the same working session that wrote and tuned the detection rules', 'The test texts are synthetic'],
    ['/de/accuracy/', 'hat ein Claude-Modell (Claude Opus 5.5) während der Entwicklung geschrieben, in derselben Arbeitssitzung, in der auch die Erkennungsregeln entstanden', 'Die Testtexte sind synthetisch'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByText(source)).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: gap })).toHaveCount(1)
    await expect(page.locator('main')).not.toContainText(/hand-written|handgeschrieben|same person|derselben Person/i)
  }
})

for (const width of [320, 390]) {
  test(`does not scroll sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    for (const path of ['/accuracy/', '/de/accuracy/']) {
      await page.goto(path)
      await page.locator('details summary').click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(width)
    }
  })
}
