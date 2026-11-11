// The Cloudflare Worker in front of Painfold's static files (wrangler.jsonc).
//
// Everything is a static asset except the name model: its largest file (135 MB)
// is over Cloudflare's 25 MiB limit for an asset, so the model files live in R2
// and this Worker serves them under the same path as everywhere else,
// /models/<id>/<revision>/, from the same origin. The Content-Security-Policy
// stays 'self', and Cloudflare only runs this code for /models/* (run_worker_first).
//
// Only the pinned files in deploy/model.ts are served. Responses carry the same
// headers as every other host (headersFor), plus their size, an ETag, and
// answers to range and conditional requests, which browsers use to resume or
// revalidate a download.
import { headersFor, MODEL_PREFIX } from './headers.ts'
import { MODEL_PATH, NAME_MODEL } from './model.ts'

// The parts of Cloudflare's R2 and Fetcher types this Worker uses, written out
// here so the Worker needs no extra type package.
export type ModelRange = { offset: number, length: number }
export type ModelObject = { size: number, httpEtag: string, uploaded: Date, body?: ReadableStream }
export type ModelBucket = {
  get: (key: string, options: { onlyIf: Headers, range?: ModelRange }) => Promise<ModelObject | null>
  head: (key: string) => Promise<ModelObject | null>
}
export type Env = { MODELS: ModelBucket, ASSETS: { fetch: (request: Request) => Promise<Response> } }

const CONTENT_TYPES: Record<string, string> = {
  json: 'application/json; charset=utf-8',
  onnx: 'application/octet-stream',
}

/** Each served path, with its R2 key (the path without its leading slash) and its pinned size. */
const FILES = new Map(Object.entries(NAME_MODEL.files).map(([file, { bytes }]) => [`${MODEL_PATH}${file}`, { key: `${MODEL_PATH.slice(1)}${file}`, bytes }]))

function respond(path: string, status: number, headers: Record<string, string> = {}, body: BodyInit | null = null): Response {
  return new Response(body, { status, headers: { ...headersFor(path), ...headers } })
}

/**
 * The bytes a Range header asks for in a file of `size` bytes: one range
 * (`bytes=0-99`, `bytes=100-`, `bytes=-100`), 'unsatisfiable' when it starts
 * past the end, or undefined to send the whole file (no header, several
 * ranges, or anything else, as HTTP allows).
 */
export function requestedRange(header: string | null, size: number): ModelRange | 'unsatisfiable' | undefined {
  const match = header?.trim().match(/^bytes=(\d*)-(\d*)$/)
  if (!match || (match[1] === '' && match[2] === '')) return undefined
  const [first, last] = match[1] === ''
    ? [Math.max(size - Number(match[2]), 0), size - 1]
    : [Number(match[1]), match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)]
  if (first >= size || (match[1] === '' && Number(match[2]) === 0)) return 'unsatisfiable'
  if (last < first) return undefined
  return { offset: first, length: last - first + 1 }
}

export async function serveModel(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname
  const file = FILES.get(path)
  if (!file) return respond(path, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found')
  if (request.method !== 'GET' && request.method !== 'HEAD') return respond(path, 405, { Allow: 'GET, HEAD' })

  const range = request.method === 'GET' ? requestedRange(request.headers.get('Range'), file.bytes) : undefined
  if (range === 'unsatisfiable') return respond(path, 416, { 'Content-Range': `bytes */${file.bytes}` })
  const object = request.method === 'HEAD' ? await env.MODELS.head(file.key) : await env.MODELS.get(file.key, { onlyIf: request.headers, range })
  if (!object) return respond(path, 404)

  const type = CONTENT_TYPES[path.slice(path.lastIndexOf('.') + 1)] ?? 'application/octet-stream'
  const headers = { 'Content-Type': type, 'ETag': object.httpEtag, 'Last-Modified': object.uploaded.toUTCString(), 'Accept-Ranges': 'bytes' }
  if (request.method === 'HEAD') return respond(path, 200, { ...headers, 'Content-Length': String(object.size) })
  // No body: a condition in the request did not hold.
  if (!object.body) {
    const revalidating = request.headers.has('If-None-Match') || request.headers.has('If-Modified-Since')
    return respond(path, revalidating ? 304 : 412, { ETag: object.httpEtag })
  }
  if (range) {
    const last = range.offset + range.length - 1
    return respond(path, 206, { ...headers, 'Content-Length': String(range.length), 'Content-Range': `bytes ${range.offset}-${last}/${object.size}` }, object.body)
  }
  return respond(path, 200, { ...headers, 'Content-Length': String(object.size) }, object.body)
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    // Cloudflare only calls the Worker for /models/*; anything else is a static file.
    return new URL(request.url).pathname.startsWith(MODEL_PREFIX) ? serveModel(request, env) : env.ASSETS.fetch(request)
  },
}
