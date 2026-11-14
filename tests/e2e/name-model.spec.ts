import type { Page } from '@playwright/test'
import { MODEL_BYTES, MODEL_CACHE } from '../../deploy/model'
import { ortBytes } from '../../deploy/ort-version'
import { expect, test } from './fixtures'

// The name model download (ROADMAP Stage 2, #64). Each test runs in a fresh
// browser context, so the model's cache starts empty, and downloads the real
// files from the local build.

const TOTAL = MODEL_BYTES + ortBytes()
const SIZE = `${Math.round(TOTAL / 1_000_000)} MB`
const MODEL_FILE = '**/onnx/model_int8.onnx'

test.describe.configure({ timeout: 60_000 })

async function openSample(page: Page, path = '/') {
  await page.goto(path)
  await page.getByRole('button', { name: path === '/' ? 'Try the sample file' : 'Beispieldatei ausprobieren' }).click()
}

/** Every request for the model or its runtime, including those the worker makes. */
function modelRequests(page: Page) {
  const urls: string[] = []
  page.on('request', (request) => {
    if (/\/(?:models|ort)\//.test(request.url())) urls.push(request.url())
  })
  return urls
}

const cachedFiles = (page: Page) => page.evaluate(async (name) => {
  if (!(await caches.has(name))) return []
  return (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname)
}, MODEL_CACHE)

const downloadButton = (page: Page) => page.getByRole('button', { name: `Download name model (${SIZE})` })
const storedLine = (page: Page) => page.getByText(`Name model stored in this browser (${SIZE}).`)

test('explains the download and its size, and requests nothing before the user agrees', async ({ page }) => {
  const requests = modelRequests(page)
  await openSample(page)
  await expect(page.getByRole('heading', { name: 'Names and places' })).toBeVisible()
  await expect(page.getByText(`Names and places need a name model: ${SIZE}, downloaded once from this site and kept in this browser.`)).toBeVisible()
  await expect(downloadButton(page)).toBeEnabled()

  await page.getByRole('button', { name: 'Find personal data in 200 rows' }).click()
  await expect(page.getByText('Names aren\'t checked.')).toBeVisible()
  await expect(page.getByRole('button', { name: `Download the name model (${SIZE})` })).toBeVisible()
  expect(requests).toEqual([])
  expect(await cachedFiles(page)).toEqual([])
})

test('downloads exactly the size it states, keeps it, and lists it in the network panel', async ({ page }) => {
  // A host may compress a file and leave out its Content-Length (Cloudflare does
  // for the runtime); then the unpacked body is counted. The 135 MB model file
  // always has one: the browser's inspector does not keep a body that large.
  const bodies = new Map<string, Promise<number>>()
  page.on('response', (response) => {
    if (!/\/(?:models|ort)\//.test(response.url()) || response.status() !== 200) return
    const length = response.headers()['content-length']
    bodies.set(response.url(), length ? Promise.resolve(Number(length)) : response.body().then(body => body.length))
  })
  await openSample(page)
  await downloadButton(page).click()
  await expect(storedLine(page)).toBeVisible({ timeout: 30_000 })

  const sizes = new Map(await Promise.all([...bodies].map(async ([url, bytes]) => [url, await bytes] as const)))
  expect([...sizes.values()].reduce((sum, bytes) => sum + bytes, 0)).toBe(TOTAL)
  expect((await cachedFiles(page)).sort()).toEqual([...sizes.keys()].map(url => new URL(url).pathname).filter(path => !path.endsWith('.mjs')).sort())

  await page.getByRole('button', { name: 'What leaves your browser' }).click()
  const panel = page.getByRole('dialog')
  await expect(panel.getByText('No data has left this browser.')).toBeVisible()
  await expect(panel.getByRole('row').filter({ hasText: 'model_int8.onnx' })).toContainText('Name model')
  await expect(panel.getByRole('row').filter({ hasText: 'model_int8.onnx' })).toContainText('135 MB')
  await expect(panel.getByRole('row').filter({ hasText: '.wasm' })).toContainText('Model runtime')
})

test('a later visit finds the stored model without downloading it, and Remove deletes it', async ({ page }) => {
  await openSample(page)
  await downloadButton(page).click()
  await expect(storedLine(page)).toBeVisible({ timeout: 30_000 })

  await page.reload()
  const requests = modelRequests(page)
  await page.getByRole('button', { name: 'Try the sample file' }).click()
  await expect(storedLine(page)).toBeVisible()
  expect(requests).toEqual([])

  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(downloadButton(page)).toBeVisible()
  expect(await cachedFiles(page)).toEqual([])
})

test('Cancel stops the download and deletes what had arrived; the keyboard focus follows', async ({ page }) => {
  // The model file never arrives, so the download is still running when it is cancelled.
  await page.route(MODEL_FILE, () => {})
  await openSample(page)
  await downloadButton(page).focus()
  await page.keyboard.press('Enter')
  const cancel = page.getByRole('button', { name: 'Cancel' })
  await expect(cancel).toBeFocused()
  await expect(page.getByRole('progressbar', { name: 'Name model download' })).toBeVisible()
  await expect(page.getByText('You can start the review now. The download goes on in the background.')).toBeVisible()
  // The runtime and the tokenizer have arrived, so there is something to delete.
  // Under a full parallel run they can take longer than the default 5 seconds.
  await expect.poll(() => cachedFiles(page), { timeout: 20_000 }).not.toEqual([])

  await page.keyboard.press('Enter')
  await expect(downloadButton(page)).toBeFocused()
  await expect(page.getByText('Download canceled.')).toBeAttached()
  expect(await cachedFiles(page)).toEqual([])
})

test('a failed download says where it stopped, the rules still work, and Try again finishes it', async ({ page }) => {
  await page.route(MODEL_FILE, route => route.abort('connectionreset'))
  await openSample(page)
  await downloadButton(page).click()
  await expect(page.getByText(/^The download stopped at \d+ of 152\sMB\. Check the connection and try again\./)).toBeVisible()
  await expect(page.getByText('Everything else is checked without it.')).toBeVisible()

  await page.unroute(MODEL_FILE)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(storedLine(page)).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Find personal data in 200 rows' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d+ findings in 200 rows$/)
})

test('offline, it says so instead of trying, and offers the download again once back online', async ({ page, context }) => {
  await openSample(page)
  await context.setOffline(true)
  await downloadButton(page).click()
  await expect(page.getByText('You\'re offline. The name model can be downloaded once you\'re back online; everything else works now.')).toBeVisible()
  await context.setOffline(false)
  await expect(downloadButton(page)).toBeVisible()
})

test('the review offers the download to people who skipped it, and the line goes once the model is ready', async ({ page }) => {
  await openSample(page)
  await page.getByRole('button', { name: 'Find personal data in 200 rows' }).click()
  await page.getByRole('button', { name: `Download the name model (${SIZE})` }).click()
  const progress = page.getByText(/^Downloading the name model: \d+ of 152\sMB$/)
  await expect(progress).toBeVisible()
  await expect(page.getByText('Names aren\'t checked.')).toBeHidden()
  await expect(progress).toBeHidden({ timeout: 30_000 })
  expect(await cachedFiles(page)).not.toEqual([])
})

test.describe('where the browser reports Save-Data', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }))
  })

  test('it suggests Wi-Fi next to the button', async ({ page }) => {
    await openSample(page)
    await expect(page.getByText('This is a large download. Consider Wi-Fi.')).toBeVisible()
  })
})

test('nothing extra is shown where the browser does not report the connection', async ({ page }) => {
  await openSample(page)
  await expect(downloadButton(page)).toBeVisible()
  await expect(page.getByText('This is a large download. Consider Wi-Fi.')).toBeHidden()
})

test('the German page explains the download in German', async ({ page }) => {
  await openSample(page, '/de/')
  await expect(page.getByRole('heading', { name: 'Namen und Orte' })).toBeVisible()
  await expect(page.getByRole('button', { name: `Namensmodell herunterladen (${SIZE})` })).toBeVisible()
})

test('where the browser cannot keep it, it says the model works for this visit only', async ({ page }) => {
  // As in a full or locked-down browser: the page cannot open the model's cache.
  await page.addInitScript(() => {
    CacheStorage.prototype.open = () => Promise.reject(new DOMException('No room', 'QuotaExceededError'))
  })
  await openSample(page)
  await downloadButton(page).click()
  await expect(page.getByText('This browser had no room to keep the name model. It works for this visit and downloads again next time.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Remove' })).toBeHidden()
})
