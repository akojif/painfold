import { llmsTxt, readSources } from '../../scripts/llms-txt'
import { expect, test } from './fixtures'

// painfold.com/llms.txt (llmstxt.org): built with the site, served as UTF-8 text.
test('llms.txt is served as UTF-8 text, as built from the sources', async ({ request }) => {
  const response = await request.get('/llms.txt')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('text/plain; charset=utf-8')
  expect(await response.text()).toBe(llmsTxt(readSources()))
})

test('the footer links to llms.txt next to the source code, in English and German', async ({ page }) => {
  for (const [path, name] of [['/', 'Footer'], ['/de/', 'Fußzeile']] as const) {
    await page.goto(path)
    const footer = page.getByRole('navigation', { name })
    await expect(footer.getByRole('link')).toHaveCount(4)
    await expect(footer.getByRole('link', { name: 'llms.txt' })).toHaveAttribute('href', '/llms.txt')
  }
})
