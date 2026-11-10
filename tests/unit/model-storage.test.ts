import { describe, expect, it } from 'vitest'
import { isCostlyConnection, isModelStored, removeModel, storedUrls } from '../../core/detect/model-storage'
import { MODEL_BYTES, MODEL_CACHE } from '../../deploy/model'

const BASE = 'https://painfold.example/'
const ORT = '/ort/1.0.0/'

/** A Cache Storage with one cache, holding responses for the given addresses. */
function fakeCaches(urls: string[], name = MODEL_CACHE) {
  const stored = new Map([[name, new Set(urls)]])
  return {
    stored,
    has: async (cache: string) => stored.has(cache),
    open: async (cache: string) => ({ match: async (url: string) => (stored.get(cache)?.has(url) ? new Response('') : undefined) }) as unknown as Cache,
    delete: async (cache: string) => stored.delete(cache),
  }
}
const modelUrls = storedUrls(BASE, ORT)

describe('the name model in this browser', () => {
  it('counts as stored only when every model file and the runtime are in its cache', async () => {
    expect(modelUrls).toContain('https://painfold.example/ort/1.0.0/ort-wasm-simd-threaded.wasm')
    expect(await isModelStored(fakeCaches(modelUrls), BASE, ORT)).toBe(true)
    expect(await isModelStored(fakeCaches(modelUrls.slice(0, -1)), BASE, ORT)).toBe(false)
    expect(await isModelStored(fakeCaches(modelUrls.slice(1)), BASE, ORT)).toBe(false)
    expect(await isModelStored(fakeCaches(modelUrls, 'another-cache'), BASE, ORT)).toBe(false)
  })

  it('counts as not stored where Cache Storage is missing or refuses to open', async () => {
    expect(await isModelStored(undefined, BASE, ORT)).toBe(false)
    const refusing = { ...fakeCaches(modelUrls), open: async () => Promise.reject(new DOMException('Blocked', 'SecurityError')) }
    expect(await isModelStored(refusing, BASE, ORT)).toBe(false)
  })

  it('removes its cache, and only its cache', async () => {
    const caches = fakeCaches(modelUrls)
    caches.stored.set('something-else', new Set())
    await removeModel(caches)
    expect([...caches.stored.keys()]).toEqual(['something-else'])
    await expect(removeModel(undefined)).resolves.toBeUndefined()
  })

  it('knows the size of its files', () => {
    expect(MODEL_BYTES).toBe(138_036_382)
  })
})

describe('isCostlyConnection', () => {
  it('is true for Save-Data or a cellular connection, and false when the browser reports nothing', () => {
    expect(isCostlyConnection({ saveData: true })).toBe(true)
    expect(isCostlyConnection({ type: 'cellular' })).toBe(true)
    expect(isCostlyConnection({ saveData: false, type: 'wifi' })).toBe(false)
    expect(isCostlyConnection({})).toBe(false)
    expect(isCostlyConnection(undefined)).toBe(false)
  })
})
