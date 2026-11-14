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
