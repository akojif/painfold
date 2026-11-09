import { test as base, expect } from '@playwright/test'

// Every end-to-end test fails if the page makes a request to any origin other
// than the app itself. This is how the "your file is never uploaded" promise
// is checked, not just stated.
export const test = base.extend<{ foreignRequests: string[] }>({
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
