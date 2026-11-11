import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { headersFor, MODEL_PREFIX } from '../../deploy/headers'
import { MODEL_PATH, NAME_MODEL } from '../../deploy/model'
import worker, { requestedRange, serveModel, type Env, type ModelObject, type ModelRange } from '../../deploy/worker'

const CONFIG = `${MODEL_PATH}config.json`
const SIZE = NAME_MODEL.files['config.json']!.bytes
const ETAG = '"abc"'

// A bucket holding the config file, which answers the way R2 does: no object
// for an unknown key, and an object without a body when a condition fails.
function env(calls: Array<{ key: string, range?: ModelRange }> = []): Env {
  const object = (body: boolean): ModelObject => ({ size: SIZE, httpEtag: ETAG, uploaded: new Date('2026-11-11T12:00:00Z'), body: body ? new Blob(['x']).stream() : undefined })
  return {
    MODELS: {
      async get(key, { onlyIf, range }) {
        calls.push({ key, range })
        if (key !== CONFIG.slice(1)) return null
        return object(onlyIf.get('If-None-Match') !== ETAG && !onlyIf.has('If-Match'))
      },
      async head(key) {
        return key === CONFIG.slice(1) ? object(false) : null
      },
    },
    ASSETS: { fetch: async () => new Response('asset') },
  }
}

const get = (path: string, headers: Record<string, string> = {}, method = 'GET') => new Request(`https://painfold.com${path}`, { method, headers })

describe('requestedRange', () => {
  it('reads one range of each form', () => {
    expect(requestedRange('bytes=0-9', 100)).toEqual({ offset: 0, length: 10 })
    expect(requestedRange('bytes=90-', 100)).toEqual({ offset: 90, length: 10 })
    expect(requestedRange('bytes=-5', 100)).toEqual({ offset: 95, length: 5 })
    expect(requestedRange('bytes=-500', 100)).toEqual({ offset: 0, length: 100 })
    expect(requestedRange('bytes=90-999', 100)).toEqual({ offset: 90, length: 10 })
  })

  it('refuses a range that starts past the end', () => {
    expect(requestedRange('bytes=100-', 100)).toBe('unsatisfiable')
    expect(requestedRange('bytes=-0', 100)).toBe('unsatisfiable')
  })

  it('sends the whole file for no range, several ranges or anything else', () => {
    for (const header of [null, 'bytes=0-1,5-6', 'items=0-1', 'bytes=-', 'bytes=9-1']) expect(requestedRange(header, 100), String(header)).toBeUndefined()
  })
})

describe('serveModel', () => {
  it('serves a pinned file with the same headers as every host, its size and an ETag', async () => {
    const response = await serveModel(get(CONFIG), env())
    expect(response.status).toBe(200)
    const headers = Object.fromEntries(response.headers)
    for (const [name, value] of Object.entries(headersFor(CONFIG))) expect(headers[name.toLowerCase()], name).toBe(value)
    expect(headers['content-length']).toBe(String(SIZE))
    expect(headers['content-type']).toBe('application/json; charset=utf-8')
    expect(headers.etag).toBe(ETAG)
    expect(headers['cache-control']).toBe('public, max-age=31536000, immutable')
  })

  it('reads the R2 key the upload script writes: the path without its leading slash', async () => {
    const calls: Array<{ key: string }> = []
    await serveModel(get(`${MODEL_PATH}onnx/model_int8.onnx`), env(calls))
    expect(calls[0]!.key).toBe(`models/${NAME_MODEL.id}/${NAME_MODEL.revision}/onnx/model_int8.onnx`)
  })

  it('answers a range with 206 and the bytes it covers', async () => {
    const calls: Array<{ key: string, range?: ModelRange }> = []
    const response = await serveModel(get(CONFIG, { Range: 'bytes=10-19' }), env(calls))
    expect(response.status).toBe(206)
    expect(calls[0]!.range).toEqual({ offset: 10, length: 10 })
    expect(response.headers.get('Content-Range')).toBe(`bytes 10-19/${SIZE}`)
    expect(response.headers.get('Content-Length')).toBe('10')
  })

  it('refuses a range past the end with 416, without asking R2', async () => {
    const calls: Array<{ key: string }> = []
    const response = await serveModel(get(CONFIG, { Range: `bytes=${SIZE}-` }), env(calls))
    expect(response.status).toBe(416)
    expect(response.headers.get('Content-Range')).toBe(`bytes */${SIZE}`)
    expect(calls).toEqual([])
  })

  it('answers revalidation with 304, and a failed If-Match with 412', async () => {
    expect((await serveModel(get(CONFIG, { 'If-None-Match': ETAG }), env())).status).toBe(304)
    expect((await serveModel(get(CONFIG, { 'If-Match': '"other"' }), env())).status).toBe(412)
  })

  it('answers HEAD with the size and no body', async () => {
    const response = await serveModel(get(CONFIG, {}, 'HEAD'), env())
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Length')).toBe(String(SIZE))
    expect(response.body).toBeNull()
  })

  it('serves nothing but the pinned files, and only for reading', async () => {
    for (const path of [`${MODEL_PATH}other.json`, '/models/other/revision/config.json', `${MODEL_PATH}../config.json`]) {
      const response = await serveModel(get(path), env())
      expect(response.status, path).toBe(404)
      expect(response.headers.get('Cross-Origin-Embedder-Policy'), path).toBe('require-corp')
    }
    const post = await serveModel(get(CONFIG, {}, 'POST'), env())
    expect(post.status).toBe(405)
    expect(post.headers.get('Allow')).toBe('GET, HEAD')
  })

  it('leaves every other path to the static files', async () => {
    expect(await (await worker.fetch(get('/accuracy'), env())).text()).toBe('asset')
  })
})

describe('wrangler.jsonc', () => {
  const config = JSON.parse(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''))

  it('runs the Worker for the model only, and serves the build as static files', () => {
    expect(config.main).toBe('deploy/worker.ts')
    expect(config.assets.directory).toBe('.output/public')
    expect(config.assets.run_worker_first).toEqual([`${MODEL_PREFIX}*`])
    expect(config.r2_buckets).toEqual([{ binding: 'MODELS', bucket_name: 'painfold-models' }])
  })

  it('serves pages at their own path and unknown paths with a real 404, as on every host', () => {
    expect(config.assets.html_handling).toBe('drop-trailing-slash')
    expect(config.assets.not_found_handling).toBe('404-page')
  })

  it('keeps no logs and sends no metrics', () => {
    expect(config.observability).toEqual({ enabled: false })
    expect(config.send_metrics).toBe(false)
  })
})
