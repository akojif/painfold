import { expect, test } from './fixtures'

test('pages and app files are served with the security headers', async ({ page, request }) => {
  const response = await page.goto('/')
  const headers = response!.headers()
  expect(headers['content-security-policy']).toBe("frame-ancestors 'none'")
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['referrer-policy']).toBe('no-referrer')

  const script = await page.locator('script[type="module"][src]').first().getAttribute('src')
  const asset = await request.get(script!)
  expect(asset.headers()['content-security-policy']).toContain("default-src 'none'")
})

test('the app runs under its Content-Security-Policy without violations', async ({ page }) => {
  const violations: string[] = []
  await page.exposeFunction('reportViolation', (text: string) => violations.push(text))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { reportViolation: (text: string) => void })
        .reportViolation(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })

  await page.goto('/')
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1)
  // Vue has mounted, so the hashed inline scripts and the app bundle ran.
  await expect.poll(() => page.evaluate(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))).toBe(true)
  expect(violations).toEqual([])
})

test('an injected inline script is blocked', async ({ page }) => {
  await page.goto('/')
  await page.addScriptTag({ content: 'window.injected = true' }).catch(() => {})
  expect(await page.evaluate(() => 'injected' in window)).toBe(false)
})

test('no cookies are set', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(await context.cookies()).toEqual([])
})

test('the theme choice is the only thing stored in the browser', async ({ page, context }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Dark' }).click()
  await page.getByRole('button', { name: 'Try the sample file' }).click()
  await page.getByRole('button', { name: /Find personal data/ }).click()
  await expect(page).toHaveURL(/\/review$/)
  await page.keyboard.press('r')
  const stored = await page.evaluate(() => ({ local: { ...localStorage }, session: sessionStorage.length }))
  expect(stored).toEqual({ local: { 'painfold-theme': 'dark' }, session: 0 })
  expect(await context.cookies()).toEqual([])
})

for (const path of ['/', '/roadmap', '/404.html']) {
  test(`the CSP meta tag on ${path} comes before everything but the charset`, async ({ request }) => {
    const html = await (await request.get(path)).text()
    const head = html.slice(html.indexOf('<head>') + '<head>'.length, html.indexOf('</head>'))
    const tags = [...head.matchAll(/<(meta|script|link|style|title|base|noscript)\b[^>]*>/gi)].map(([tag]) => tag)
    expect(tags[0]).toMatch(/^<meta charset=/i)
    expect(tags[1]).toMatch(/^<meta http-equiv="Content-Security-Policy"/)
  })
}

test('pages are cross-origin isolated, so the name model can use threads', async ({ page }) => {
  await page.goto('/')
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
})

test('the name model is served from this site, exactly the pinned file, cached for good', async ({ request }) => {
  const { MODEL_PATH, NAME_MODEL } = await import('../../deploy/model')
  const response = await request.get(`${MODEL_PATH}onnx/model_int8.onnx`)
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable')
  const { createHash } = await import('node:crypto')
  expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(NAME_MODEL.files['onnx/model_int8.onnx'])
})

test('the ONNX Runtime WebAssembly files are served from this site with a policy that allows WebAssembly', async ({ request }) => {
  const { ORT_PREFIX } = await import('../../deploy/model')
  const { ortVersion } = await import('../../deploy/ort-version')
  const response = await request.get(`${ORT_PREFIX}${ortVersion()}/ort-wasm-simd-threaded.wasm`)
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('application/wasm')
  expect(response.headers()['content-security-policy']).toContain("'wasm-unsafe-eval'")
  const page = await request.get('/')
  expect(await page.text()).not.toContain('wasm-unsafe-eval')
})
