import type { Page, Route } from '@playwright/test'
import { expect, openSample, test } from './fixtures'

// Stage 3, slice 6 (#128): the first report. Playwright stands in for
// Anthropic with fixed answers, so every number on the page can be checked
// against what the answers said. The key is invented; nothing reaches Anthropic.
test.use({ allowedOrigins: ['https://api.anthropic.com'] })

type Sent = { id: string, text: string }
type Label = { id: string, label: string }

const contentOf = (route: Route) => JSON.parse(JSON.parse(route.request().postData()!).messages[0].content)
const reply = (route: Route, json: unknown) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  headers: { 'access-control-allow-origin': '*' },
  body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 100, output_tokens: 50 } }),
})

// Every text: the job "Export reports". Every third text: the pain "Slow
// exports" (strong), quoting its first 15 characters. The first two texts:
// the gain "Dark mode", which stays under five texts.
const number = (id: string) => Number(id.slice(1))
function tag(route: Route) {
  const { texts } = contentOf(route) as { texts: Sent[] }
  return reply(route, {
    texts: texts.map(({ id, text }) => ({
      id,
      jobs: [{ label: 'Export reports', intensity: 2, quote: '' }],
      pains: number(id) % 3 === 0 ? [{ label: 'Slow exports', intensity: 3, quote: text.slice(0, 15) }] : [],
      gains: number(id) <= 2 ? [{ label: 'Dark mode', intensity: 1, quote: '' }] : [],
      sentiment: 'negative',
      type: 'complaint',
    })),
  })
}

/** Each label its own theme, named after it. */
function merge(route: Route) {
  const { labels } = contentOf(route) as { labels: Label[] }
  return reply(route, { themes: labels.map(label => ({ name: label.label, labels: [label.id] })) })
}

async function analyzeSample(page: Page) {
  let requests = 0
  const texts: Sent[] = []
  await page.route('https://api.anthropic.com/**', (route) => {
    requests++
    const content = contentOf(route)
    if ('kind' in content) return merge(route)
    texts.push(...content.texts)
    return tag(route)
  })
  await page.goto('/')
  await openSample(page)
  await page.getByRole('button', { name: /^Find personal data in/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
  await page.getByRole('link', { name: 'Continue to analyze' }).last().click()
  await expect(page).toHaveURL(/\/analyze\/$/)
  await page.getByLabel('API key', { exact: true }).fill('sk-ant-invented-test-key')
  await page.getByLabel('I have checked these texts for names, or they contain none.').check()
  await page.getByRole('button', { name: /^Send \d+ cleaned texts to Anthropic$/ }).click()
  await page.getByRole('link', { name: 'Show the report' }).click()
  await expect(page).toHaveURL(/\/report\/$/)
  return { texts, requests: () => requests }
}

test('the report ranks jobs, pains and gains with numbers counted from the answers, and sends nothing', async ({ page }) => {
  const { texts, requests } = await analyzeSample(page)
  const sentBefore = requests()
  const total = texts.length
  const pains = texts.filter(({ id }) => number(id) % 3 === 0).length

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What customers said')
  await expect(page.getByText(`${total} texts analyzed with Claude Haiku 5.5.`)).toBeVisible()
  await expect(page.getByText('A text can appear under several themes.')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Jobs', 'Pains', 'Gains', 'The cleaned file'])
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link')).toHaveText(['Jobs 1', 'Pains 1', 'Gains 1'])

  const jobs = page.getByRole('region', { name: 'Jobs' })
  const job = jobs.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Export reports' }) })
  await expect(job).toContainText(`${total}`)
  await expect(job).toContainText('100%')
  await expect(job).toContainText('Moderate 2.0')

  const pain = page.getByRole('region', { name: 'Pains' }).getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Slow exports' }) })
  await expect(pain).toContainText(`${pains}`)
  await expect(pain).toContainText(`${Math.round(pains / total * 100)}%`)
  await expect(pain).toContainText('Strong 3.0')
  // Three quotes, from the first texts with the pain, each word for word in its text.
  await expect(pain.locator('q')).toHaveCount(3)
  const first = texts.find(({ id }) => number(id) % 3 === 0)!
  await expect(pain.locator('q').first()).toHaveText(first.text.slice(0, 15).trim())

  // Its source opens the whole text as it was sent.
  const source = pain.getByRole('button', { name: /^Row \d+$/ }).first()
  await source.click()
  await expect(source).toHaveAttribute('aria-expanded', 'true')
  await expect(pain.locator(`#${await source.getAttribute('aria-controls')}`)).toContainText(first.text.replace(/\s+/g, ' ').slice(0, 40))

  await pain.getByRole('button', { name: `All ${pains} texts` }).click()
  await expect(pain.getByRole('button', { name: /^Row \d+$/ })).toHaveCount(3 + pains)

  // Under five texts: listed apart, by name and count, its evidence on request.
  const gains = page.getByRole('region', { name: 'Gains' })
  await expect(gains.getByRole('heading', { level: 3 })).toHaveText('1 more gain, found in fewer than 5 texts')
  await expect(gains.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3 }) })).toHaveCount(0)
  const few = gains.getByRole('button', { name: 'Dark mode 2 texts' })
  await few.click()
  await expect(gains.getByText('No quote was found word for word for this theme.')).toBeVisible()

  expect(requests()).toBe(sentBefore)
})

test('every bar uses one scale across jobs, pains and gains', async ({ page }) => {
  const { texts } = await analyzeSample(page)
  const pains = texts.filter(({ id }) => number(id) % 3 === 0).length
  const bars = page.locator('[aria-hidden="true"] > span[style*="scaleX"]')
  // The job is in every text: the largest share, a full bar. The pain's bar is its share of that.
  await expect(bars.first()).toHaveAttribute('style', /scaleX\(1\)/)
  const style = await bars.nth(1).getAttribute('style')
  expect(Number(style!.match(/scaleX\(([\d.]+)\)/)![1])).toBeCloseTo(pains / texts.length, 5)
})

/** Opens the report after the review, before any analysis: reachable only by going back and forth in history. */
async function reportBeforeAnalysis(page: Page, start = '/') {
  await page.goto(start)
  await openSample(page)
  await page.getByRole('button', { name: start === '/' ? /^Find personal data in/ : /^Personenbezogene Daten in/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
  await page.evaluate(path => (document.querySelector('#__nuxt') as unknown as { __vue_app__: { config: { globalProperties: { $router: { push: (to: string) => Promise<void> } } } } }).__vue_app__.config.globalProperties.$router.push(path), `${start}report/`)
}

test('reviewed but not analyzed yet, the report says why and leads to Analyze', async ({ page }) => {
  await reportBeforeAnalysis(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No report yet')
  await page.getByRole('link', { name: 'Go to Analyze' }).click()
  await expect(page).toHaveURL(/\/analyze\/$/)
})

test('without a reviewed file, a direct link leads to the start page', async ({ page }) => {
  await page.goto('/report/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find what hurts your customers. Without exposing who they are.')
})

test('the German report uses the German terms', async ({ page }) => {
  await reportBeforeAnalysis(page, '/de/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Noch kein Bericht')
  await expect(page.getByRole('link', { name: 'Zur Analyse' })).toBeVisible()
})

test('the report is step 4 and offers the cleaned file too', async ({ page }) => {
  await analyzeSample(page)
  const steps = page.getByRole('navigation', { name: 'Steps' })
  await expect(steps.getByRole('listitem')).toHaveText([/Import/, /Review/, /Analyze/, /Report/])
  await expect(steps.locator('[aria-current="step"]')).toHaveText(/Report/)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the cleaned file' }).click()])
  expect(download.suggestedFilename()).toBe('support-tickets_cleaned.csv')
})
