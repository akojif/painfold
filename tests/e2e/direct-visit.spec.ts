import type { Page } from '@playwright/test'
import { expect, openSample, test } from './fixtures'

// Opening a step of the working flow with nothing open (a shared link, a
// bookmark, a reload): the step never shows, not even briefly, and the start
// page it leads to is laid out exactly as on a fresh load.
const STEPS = ['/review/', '/download/', '/analyze/', '/report/']

/** The start page's headline: how many lines, how wide, and whether the example card overlaps it. */
const startLayout = (page: Page) => page.evaluate(() => {
  const headline = document.querySelector('main h1')!
  const example = document.querySelector('main figure')!
  const a = headline.getBoundingClientRect()
  const b = example.getBoundingClientRect()
  return {
    lines: Math.round(a.height / parseFloat(getComputedStyle(headline).lineHeight)),
    width: Math.round(a.width),
    hero: Math.round(headline.closest('section')!.getBoundingClientRect().width),
    overlaps: !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top),
  }
})

/** Follows a direct visit until it reaches the start page; while the step's address shows, nothing in main may be visible. */
async function visitUntilStart(page: Page, path: string, start: string) {
  await page.goto(path, { waitUntil: 'commit' })
  for (let i = 0; i < 200; i++) {
    // Only once the stylesheets have loaded: a browser paints nothing before that, so there is nothing to see yet.
    const state = await page.evaluate(() => {
      const styled = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].every(link => link.sheet !== null)
      return styled ? { path: location.pathname, text: document.querySelector('main')?.innerText.trim() ?? '' } : undefined
    }).catch(() => undefined)
    if (state?.path === start) break
    if (state) expect(state.text, `${path}: visible before the start page`).toBe('')
    await page.waitForTimeout(15)
  }
  await expect(page).toHaveURL(new RegExp(`${start}$`))
}

for (const [language, prefix] of [['English', ''], ['German', '/de']] as const) {
  test(`${language}: a direct visit to a step with nothing open shows nothing of it and leads to an intact start page`, async ({ page, request }) => {
    const start = `${prefix}/`
    await page.goto(start)
    await expect(page.locator('main h1')).toBeVisible()
    const fresh = await startLayout(page)
    expect(fresh.overlaps).toBe(false)

    for (const step of STEPS) {
      const path = `${prefix}${step}`
      // The served page holds no step: its only heading is the small-screen notice, hidden on wide screens.
      const html = await (await request.get(path)).text()
      expect(html.match(/<h1/g) ?? [], path).toHaveLength(1)

      const fresh2 = await browserLayoutAfter(page, path, start)
      expect(fresh2, path).toEqual(fresh)
      // The step's address is replaced, so Back does not lead to it again.
      expect(await page.evaluate(() => history.length), path).toBeLessThanOrEqual(2)
    }
  })
}

async function browserLayoutAfter(page: Page, path: string, start: string) {
  const fresh = await page.context().newPage()
  await visitUntilStart(fresh, path, start)
  await expect(fresh.locator('main h1')).toBeVisible()
  const layout = await startLayout(fresh)
  await fresh.close()
  return layout
}

for (const step of ['review', 'analyze'] as const) {
  test(`reloading ${step} mid-flow leads to an intact start page, after the browser asks`, async ({ page }) => {
    await page.goto('/')
    const fresh = await startLayout(page)
    await openSample(page)
    await page.getByRole('button', { name: /^Find personal data in/ }).click()
    await expect(page).toHaveURL(/\/review\/$/)
    if (step === 'analyze') {
      await page.getByRole('link', { name: 'Continue to analyze' }).last().click()
      await expect(page).toHaveURL(/\/analyze\/$/)
    }
    // The work is in this tab's memory only: the browser asks before it is lost.
    let asked = false
    page.on('dialog', (dialog) => {
      asked = dialog.type() === 'beforeunload'
      void dialog.accept()
    })
    await page.reload()
    expect(asked).toBe(true)
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('main h1')).toBeVisible()
    expect(await startLayout(page)).toEqual(fresh)
  })
}
