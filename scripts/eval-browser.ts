// Runs the name model the way users run it: the built names worker, in
// Chromium, on the WebAssembly runtime, with the page cross-origin isolated so
// it uses threads. Native ONNX Runtime in Node gives different results per
// processor (see tests/model/name-model.test.ts), so name accuracy is only
// ever measured here.
//
// Needs a build (`npm run generate`). Serves it with scripts/serve-static.ts,
// the same server and headers as the end-to-end tests; nothing leaves the
// machine.
import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { chromium, type Page } from '@playwright/test'
import type { Detection } from '../core/detect/types.ts'
import type { ItemDetections } from '../core/detect/items.ts'
import { ORT_PREFIX } from '../deploy/model.ts'
import { ortVersion } from '../deploy/ort-version.ts'

const PORT = 4183
const BASE = `http://localhost:${PORT}`

/** The built names worker, under /_nuxt/ with a hashed file name. */
export function workerPath(): string {
  const file = readdirSync('.output/public/_nuxt', { withFileTypes: true }).map(entry => entry.name).find(name => /^names\.worker-.*\.js$/.test(name))
  if (!file) throw new Error('No names worker in .output/public/_nuxt. Run `npm run generate` first.')
  return `/_nuxt/${file}`
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await fetch(BASE).then(response => response.ok, () => false)) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`The static server did not start on ${BASE}`)
}

export type BrowserRun = { detections: Detection[][], milliseconds: number, threads: boolean }

/**
 * Finds names and places in each text with the built names worker, in an open
 * page of the app. The worker (and with it the loaded model) is kept on the
 * page and reused by later calls, so the model loads once per page.
 */
export async function namesInPage(page: Page, texts: readonly string[], { firstNames = true }: { firstNames?: boolean } = {}): Promise<BrowserRun> {
  const ortPath = `${ORT_PREFIX}${ortVersion()}/`
  const run = await page.evaluate(async ({ worker, ortPath, texts, firstNames }) => {
    const started = performance.now()
    const scope = window as unknown as { painfoldNames?: Worker, painfoldNamesId?: number }
    scope.painfoldNames ??= new Worker(worker, { type: 'module' })
    const names = scope.painfoldNames
    const id = (scope.painfoldNamesId = (scope.painfoldNamesId ?? 0) + 1)
    const cells = await new Promise<unknown>((resolve, reject) => {
      const onMessage = ({ data }: MessageEvent) => {
        if (data.id !== id) return
        if (data.kind === 'result' || data.kind === 'error') names.removeEventListener('message', onMessage)
        if (data.kind === 'result') resolve(data.items)
        if (data.kind === 'error') reject(new Error(data.message))
      }
      names.addEventListener('message', onMessage)
      names.postMessage({ kind: 'names', id, items: texts.map((text, index) => ({ id: String(index), text })), ortPath, firstNames })
    })
    return { cells, milliseconds: performance.now() - started, threads: crossOriginIsolated }
  }, { worker: workerPath(), ortPath, texts: [...texts], firstNames })

  const detections: Detection[][] = texts.map(() => [])
  for (const item of run.cells as ItemDetections[]) detections[Number(item.id)] = item.detections
  return { detections, milliseconds: run.milliseconds, threads: run.threads }
}

/** The same, with its own static server and browser, for scripts. */
export async function detectNamesInBrowser(texts: readonly string[], options: { firstNames?: boolean } = {}): Promise<BrowserRun> {
  workerPath() // fails early, before a server is started, if there is no build
  const server = spawn(process.execPath, ['scripts/serve-static.ts', '--port', String(PORT)], { stdio: 'ignore' })
  const browser = await chromium.launch()
  try {
    await waitForServer()
    const page = await browser.newPage()
    await page.goto(BASE)
    return await namesInPage(page, texts, options)
  }
  finally {
    await browser.close()
    server.kill()
  }
}
