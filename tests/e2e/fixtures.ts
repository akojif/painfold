import { test as base, expect, type Page } from '@playwright/test'

// Every end-to-end test fails if the page makes a request to any origin other
// than the app itself. This is how the "your file is never uploaded" promise
// is checked, not just stated.
//
// Every page.goto and page.reload also waits until Vue has hydrated the page.
// Before that, the page looks ready but has no event handlers: a file set on
// the file input right after loading was silently ignored, which made tests
// flaky on CI, and a click right after a reload did nothing on a deployed site.
/** Makes page.goto and page.reload wait until Vue has hydrated the page. */
export function waitForHydrationOnGoto(page: Page): Page {
  const hydrated = () => page.waitForFunction(() => {
    const root = document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: { $nuxt?: { isHydrating?: boolean } } }) | null
    return root?.__vue_app__?.$nuxt?.isHydrating === false
  })
  const goto = page.goto.bind(page)
  page.goto = async (...args) => {
    const response = await goto(...args)
    await hydrated()
    return response
  }
  const reload = page.reload.bind(page)
  page.reload = async (...args) => {
    const response = await reload(...args)
    await hydrated()
    return response
  }
  return page
}

// Every test fails if the page talks to another origin. Only the tests of the
// AI step list the AI endpoints they stand in for (test.use({ allowedOrigins })).
export const test = base.extend<{ foreignRequests: string[], allowedOrigins: string[] }>({
  allowedOrigins: [[], { option: true }],
  page: async ({ page }, use) => {
    await use(waitForHydrationOnGoto(page))
  },
  foreignRequests: [async ({ page, baseURL, allowedOrigins }, use) => {
    const appOrigin = new URL(baseURL!).origin
    const foreign: string[] = []

    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.protocol === 'data:' || url.protocol === 'blob:') return
      if (url.origin !== appOrigin && !allowedOrigins.includes(url.origin)) foreign.push(request.url())
    })

    await use(foreign)

    expect(foreign, 'requests to other origins').toEqual([])
  }, { auto: true }],
})

export { expect }

/** Opens the made-up sample file the way people do: "Try an example", then "Open the sample" (ExampleDialog.vue). */
export async function openSample(page: Page) {
  await page.getByRole('button', { name: /^(Try an example|Beispiel ausprobieren)$/ }).click()
  await page.getByRole('button', { name: /^(Open the sample|Beispieldatei öffnen)$/ }).click()
}

/** The open file's row count, as the workspace sidebar on the column step shows it (#141). */
export async function expectRows(page: Page, rows: number) {
  const sidebar = page.getByRole('complementary', { name: /^(File and columns|Datei und Spalten)$/ })
  const row = sidebar.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^(Rows|Zeilen)$/ }) })
  await expect(row.locator('dd')).toHaveText(String(rows))
}

/**
 * Analyze in two steps (#141): sets up Anthropic with an invented key and
 * passes the connection test, so the step that sends appears. Answers only the
 * test's "Hello"; nothing reaches Anthropic.
 */
export async function connectAnthropic(page: Page, key = 'sk-ant-invented-test-key') {
  const hello = (route: import('@playwright/test').Route) => {
    const body = route.request().postDataJSON() as { messages?: Array<{ content?: unknown }> } | null
    if (body?.messages?.[0]?.content !== 'Hello') return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ content: [{ type: 'text', text: 'Hi' }] }) })
  }
  await page.route('https://api.anthropic.com/**', hello)
  await page.getByLabel('API key', { exact: true }).fill(key)
  await page.getByRole('button', { name: 'Test connection' }).click()
  await expect(page.getByRole('region', { name: 'Connected' })).toBeVisible()
  await page.unroute('https://api.anthropic.com/**', hello)
}

/** Opens the list of texts that will be sent, in the panel on the right (#141). */
export async function openSentTexts(page: Page) {
  await page.getByRole('button', { name: /^Review what will be sent/ }).click()
  return page.getByRole('region', { name: 'The texts that will be sent' })
}
