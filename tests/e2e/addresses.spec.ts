import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Every page has one address, ending in a slash (/roadmap/, /de/): links, the
// canonical link and the hreflang links all use it, and the form without the
// slash redirects there, so search engines never see two addresses for a page.

const PAGES = ['/', '/roadmap/', '/accuracy/', '/de/', '/de/roadmap/', '/de/accuracy/']

/** Every address on the page that points into the site: links, the canonical link and the hreflang links. */
const addresses = (page: Page) => page.evaluate(() => [
  ...[...document.querySelectorAll<HTMLAnchorElement>('a[href]')].map(link => link.href),
  ...[...document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"], link[rel="alternate"][hreflang]')].map(link => link.href),
])

/** The page addresses among them: on this site or the production site, not files, not other sites. */
function pageAddresses(urls: string[], origin: string): string[] {
  return urls
    .map(url => new URL(url))
    .filter(url => url.origin === origin || url.hostname === 'painfold.com' || url.hostname === 'painfold.vercel.app')
    .filter(url => !/\.[a-z0-9]+$/i.test(url.pathname))
    .map(url => url.pathname)
}

for (const path of PAGES.filter(path => path !== '/')) {
  test(`${path.slice(0, -1)} redirects to ${path}`, async ({ request }) => {
    const response = await request.get(path.slice(0, -1), { maxRedirects: 0 })
    expect([301, 307, 308]).toContain(response.status())
    expect(new URL(response.headers().location!, 'http://site').pathname).toBe(path)
    expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(200)
  })
}

test('the query is kept when an address gets its slash', async ({ request }) => {
  const response = await request.get('/roadmap?ref=readme', { maxRedirects: 0 })
  expect(new URL(response.headers().location!, 'http://site').search).toBe('?ref=readme')
})

test('every link, canonical and hreflang link on every page ends in a slash', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  for (const path of PAGES) {
    await page.goto(path)
    const found = pageAddresses(await addresses(page), origin)
    expect(found.length, path).toBeGreaterThan(0)
    expect(found.filter(address => !address.endsWith('/')), path).toEqual([])
  }
})

test('the review and download steps link with a slash too', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the sample file' }).click()
  await page.getByRole('button', { name: /^Find personal data in/ }).click()
  await expect(page).toHaveURL(/\/review\/$/)
  expect(pageAddresses(await addresses(page), origin).filter(address => !address.endsWith('/'))).toEqual([])
  await page.getByRole('link', { name: 'Continue to download' }).last().click()
  await expect(page).toHaveURL(/\/download\/$/)
  expect(pageAddresses(await addresses(page), origin).filter(address => !address.endsWith('/'))).toEqual([])
})
