// Serves the generated site from .output/public for local preview and end-to-end tests,
// with the same security headers as production (deploy/headers.ts).
// Uses only Node built-ins, so it adds no dependency.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { headersFor } from '../deploy/headers.ts'

const { values } = parseArgs({ options: { port: { type: 'string', default: '4173' } } })
const root = resolve('.output/public')

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

async function resolveFile(urlPath: string): Promise<string | undefined> {
  let decoded: string
  try {
    decoded = decodeURIComponent(urlPath)
  }
  catch {
    // A malformed address such as /%E0%A4 names no file; it gets the 404 page.
    return undefined
  }
  const safePath = normalize(decoded).replace(/^(\.\.[/\\])+/, '')
  const candidate = join(root, safePath)
  if (!candidate.startsWith(root)) return undefined

  for (const path of [candidate, join(candidate, 'index.html'), `${candidate}.html`]) {
    const info = await stat(path).catch(() => undefined)
    if (info?.isFile()) return path
  }
  return undefined
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const file = await resolveFile(url.pathname) ?? await resolveFile('/404.html')

  if (!file) {
    response.writeHead(404).end()
    return
  }

  const status = file.endsWith('404.html') && url.pathname !== '/404.html' ? 404 : 200
  // Content-Length lets the app show how much of the name model has downloaded.
  const { size } = await stat(file)
  response.writeHead(status, {
    ...headersFor(url.pathname),
    'Content-Length': String(size),
    'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
  })
  createReadStream(file).pipe(response)
}).listen(Number(values.port), () => {
  console.log(`Serving ${root} at http://localhost:${values.port}`)
})
