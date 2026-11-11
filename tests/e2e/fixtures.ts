import { test as base, expect, type Page } from '@playwright/test'

// Every end-to-end test fails if the page makes a request to any origin other
// than the app itself. This is how the "your file is never uploaded" promise
// is checked, not just stated.
//
// Every page.goto also waits until Vue has hydrated the page. Before that, the
// page looks ready but has no event handlers: a file set on the file input
// right after loading was silently ignored, which made tests flaky on CI.
/** Makes page.goto wait until Vue has hydrated the page. */
export function waitForHydrationOnGoto(page: Page): Page {
  const goto = page.goto.bind(page)
  page.goto = async (...args) => {
    const response = await goto(...args)
    await page.waitForFunction(() => {
      const root = document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: { $nuxt?: { isHydrating?: boolean } } }) | null
      return root?.__vue_app__?.$nuxt?.isHydrating === false
    })
    return response
  }
  return page
}

export const test = base.extend<{ foreignRequests: string[] }>({
  page: async ({ page }, use) => {
    await use(waitForHydrationOnGoto(page))
  },
  foreignRequests: [async ({ page, baseURL }, use) => {
    const appOrigin = new URL(baseURL!).origin
    const foreign: string[] = []

    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.protocol === 'data:' || url.protocol === 'blob:') return
      if (url.origin !== appOrigin) foreign.push(request.url())
    })

    await use(foreign)

    expect(foreign, 'requests to other origins').toEqual([])
  }, { auto: true }],
})

export { expect }
