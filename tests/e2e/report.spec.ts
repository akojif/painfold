import type { Page, Route } from '@playwright/test'
import { connectAnthropic, expect, openSample, test } from './fixtures'

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
  await connectAnthropic(page)
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
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['On this page', 'The cleaned file', 'Jobs', 'Pains', 'Gains'])
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link')).toHaveText(['Jobs 1', 'Pains 1', 'Gains 1'])

  // Each kind is a table, one row per theme, with the numbers counted in code.
  const jobs = page.getByRole('region', { name: 'Jobs' })
  await expect(jobs.getByRole('columnheader')).toHaveText(['Theme', 'Texts', 'Share', 'Intensity'])
  const job = jobs.getByRole('row').filter({ hasText: 'Export reports' })
  await expect(job.getByRole('cell')).toHaveText(['Export reports', `${total}`, '100%', /^Moderate 2\.0/])

  const pain = page.getByRole('region', { name: 'Pains' }).getByRole('row').filter({ hasText: 'Slow exports' })
  await expect(pain.getByRole('cell')).toHaveText(['Slow exports', `${pains}`, `${Math.round(pains / total * 100)}%`, /^Strong 3\.0/])

  // The evidence opens in the drawer, with focus on its heading.
  const theme = pain.getByRole('button', { name: 'Slow exports' })
  await theme.click()
  await expect(theme).toHaveAttribute('aria-expanded', 'true')
  const drawer = page.getByRole('region', { name: 'Slow exports' })
  await expect(drawer.getByRole('heading', { level: 2 })).toBeFocused()
  await expect(drawer).toContainText('Pains')
  await expect(drawer.getByRole('definition')).toHaveText([`${pains}`, `${Math.round(pains / total * 100)}%`, /^Strong 3\.0/])
  // Three quotes, from the first texts with the pain, each word for word in its text.
  await expect(drawer.locator('q')).toHaveCount(3)
  const first = texts.find(({ id }) => number(id) % 3 === 0)!
  await expect(drawer.locator('q').first()).toHaveText(first.text.slice(0, 15).trim())

  // Its source opens the whole text as it was sent.
  const source = drawer.getByRole('button', { name: /^Row \d+$/ }).first()
  await source.click()
  await expect(source).toHaveAttribute('aria-expanded', 'true')
  await expect(drawer.locator(`#${await source.getAttribute('aria-controls')}`)).toContainText(first.text.replace(/\s+/g, ' ').slice(0, 40))

  await drawer.getByRole('button', { name: `All ${pains} texts` }).click()
  await expect(drawer.getByRole('button', { name: /^Row \d+$/ })).toHaveCount(3 + pains)

  // Escape closes it and returns focus to the theme.
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(theme).toBeFocused()

  // Under five texts: listed apart, by name and count, its evidence in the drawer too.
  const gains = page.getByRole('region', { name: 'Gains' })
  await expect(gains.getByRole('heading', { level: 3 })).toHaveText('1 more gain, found in fewer than 5 texts')
  await expect(gains.getByRole('table')).toHaveCount(0)
  await gains.getByRole('button', { name: 'Dark mode 2 texts' }).click()
  const few = page.getByRole('region', { name: 'Dark mode' })
  await expect(few).toContainText('No quote was found word for word for this theme.')
  await expect(few).not.toContainText('Share')
  await few.getByRole('button', { name: 'Close details' }).click()
  await expect(gains.getByRole('button', { name: 'Dark mode 2 texts' })).toBeFocused()

  expect(requests()).toBe(sentBefore)
})

test('every bar uses one scale across jobs, pains and gains', async ({ page }) => {
  const { texts } = await analyzeSample(page)
  const pains = texts.filter(({ id }) => number(id) % 3 === 0).length
  const bars = page.getByRole('main').locator('svg[data-value]')
  // The job is in every text: the largest share, a full bar. The pain's bar is its share of that.
  await expect(bars.first()).toHaveAttribute('data-value', '1')
  expect(Number(await bars.nth(1).getAttribute('data-value'))).toBeCloseTo(pains / texts.length, 5)
})

/** The WCAG contrast ratio of two rgb() colours, as computed by the browser. */
function contrast(a: string, b: string) {
  const luminance = (color: string) => {
    const [r, g, b] = color.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

for (const scheme of ['light', 'dark'] as const) {
  test(`in ${scheme} mode the bars stand out from the page and their track, and every bar has its number beside it`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await analyzeSample(page)
    const bars = page.getByRole('main').locator('svg[data-value]')
    await expect(bars.first()).toBeVisible()
    const colours = await bars.first().evaluate((svg) => {
      const [track, bar] = [...svg.querySelectorAll('rect')].map(rect => getComputedStyle(rect).fill)
      return { track: track!, bar: bar!, page: getComputedStyle(document.body).backgroundColor }
    })
    expect(contrast(colours.bar, colours.page)).toBeGreaterThanOrEqual(3)
    expect(contrast(colours.bar, colours.track)).toBeGreaterThanOrEqual(3)
    // Decoration only: hidden from screen readers, and the share is written in the same cell.
    for (const bar of await bars.all()) {
      await expect(bar).toHaveAttribute('aria-hidden', 'true')
      await expect(bar.locator('xpath=ancestor::td[1]')).toHaveText(/^\d+(\.\d+)?\s?%$/)
    }
  })
}

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

test('at 768 px the report has the top bar, the sidebar above the tables and no sideways scroll; the drawer floats', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await analyzeSample(page)
  await expect(page.getByRole('navigation', { name: 'Steps' }).getByRole('listitem')).toHaveCount(4)
  await expect(page.getByRole('complementary', { name: 'Sections and the cleaned file' })).toBeVisible()
  await page.getByRole('region', { name: 'Pains' }).getByRole('button', { name: 'Slow exports' }).click()
  await expect(page.getByRole('region', { name: 'Slow exports' })).toBeVisible()
  for (const language of ['en', 'de']) {
    // After the analysis the top bar counts kilobytes, rounded, so German fits too.
    await expect(page.getByRole('button', { name: /What leaves your browser|Was Ihren Browser verlässt/ })).toContainText(/\d+ kB/)
    if (language === 'de') {
      await page.getByRole('button', { name: 'German' }).click()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Was Ihre Kunden sagen')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768)
  }
})
