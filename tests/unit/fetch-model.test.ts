import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { download, fetchWithRetry, huggingFaceInit } from '../../scripts/fetch-model'

// The build downloads the name model from Hugging Face, which can answer 429
// when a shared build machine hits its rate limit. No request is made here.
const answers = (...steps: Array<number | Error | [number, string]>) => {
  const calls: string[] = []
  const get = async (url: string) => {
    calls.push(url)
    const step = steps.shift()!
    if (step instanceof Error) throw step
    const [status, retryAfter] = Array.isArray(step) ? step : [step, undefined]
    return new Response(null, { status, headers: retryAfter ? { 'retry-after': retryAfter } : {} })
  }
  return { calls, get: get as unknown as typeof fetch }
}

describe('downloading the name model', () => {
  it('tries again after 429, a server error or a network error, waiting longer each time', async () => {
    const { calls, get } = answers(429, 503, new Error('socket hang up'), 200)
    const waits: number[] = []
    const response = await fetchWithRetry('https://example.com/a', { fetch: get, wait: async ms => waits.push(ms) })
    expect(response.status).toBe(200)
    expect(calls).toHaveLength(4)
    expect(waits).toEqual([2000, 4000, 8000])
  })

  it('waits as long as the server asks, up to a minute', async () => {
    const waits: number[] = []
    await fetchWithRetry('https://example.com/a', { fetch: answers([429, '5'], [429, '3600'], 200).get, wait: async ms => waits.push(ms) })
    expect(waits).toEqual([5000, 60000])
  })

  it('does not retry a missing file, and gives up after the last attempt', async () => {
    const missing = answers(404)
    expect((await fetchWithRetry('https://example.com/a', { fetch: missing.get, wait: async () => {} })).status).toBe(404)
    expect(missing.calls).toHaveLength(1)
    const busy = answers(429, 429, 429)
    expect((await fetchWithRetry('https://example.com/a', { fetch: busy.get, wait: async () => {}, attempts: 3 })).status).toBe(429)
    expect(busy.calls).toHaveLength(3)
  })
})

describe('the Hugging Face token', () => {
  it('is sent as a bearer token when the build has one, and nothing is sent without it', async () => {
    expect(huggingFaceInit(' hf_example\n')).toEqual({ headers: { authorization: 'Bearer hf_example' } })
    expect(huggingFaceInit('hf_example')).toEqual({ headers: { authorization: 'Bearer hf_example' } })
    expect(huggingFaceInit(' ')).toBeUndefined()
    expect(huggingFaceInit(undefined)).toBeUndefined()
    const seen: Array<RequestInit | undefined> = []
    const get = (async (_url: string, init?: RequestInit) => {
      seen.push(init)
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch
    await fetchWithRetry('https://example.com/a', { fetch: get, init: huggingFaceInit('hf_example') })
    expect(seen).toEqual([{ headers: { authorization: 'Bearer hf_example' } }])
  })
})

describe('where the model comes from', () => {
  const bytes = new TextEncoder().encode('{"model":"invented"}')
  const expected = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength }
  const fake = (answer: (url: string) => Response) => {
    const calls: Array<{ url: string, init?: RequestInit }> = []
    const get = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return answer(url)
    }) as unknown as typeof fetch
    return { calls, get }
  }
  const noWait = async () => {}

  it('tries the GitHub release copy first, with a flat file name and never the token', async () => {
    const { calls, get } = fake(() => new Response(bytes))
    expect(await download('onnx/model_int8.onnx', expected, { fetch: get, wait: noWait, token: 'hf_example' })).toEqual(bytes)
    expect(calls).toEqual([{ url: 'https://github.com/akojif/painfold/releases/download/name-model-c2a4dbf/model_int8.onnx', init: undefined }])
  })

  it('falls back to Hugging Face, with the token, when the copy fails or differs', async () => {
    for (const copy of [new Response(null, { status: 404 }), new Response('changed')]) {
      const { calls, get } = fake(url => (url.includes('github.com') ? copy.clone() : new Response(bytes)))
      expect(await download('config.json', expected, { fetch: get, wait: noWait, token: 'hf_example' })).toEqual(bytes)
      expect(calls.at(-1)).toEqual({ url: 'https://huggingface.co/Xenova/distilbert-base-multilingual-cased-ner-hrl/resolve/c2a4dbf593c57f47004c5bc2d3770d311aee9c43/config.json', init: { headers: { authorization: 'Bearer hf_example' } } })
    }
  })

  it('fails with every reason when no source gives the right file', async () => {
    const { get } = fake(url => (url.includes('github.com') ? new Response('changed') : new Response(null, { status: 429 })))
    await expect(download('config.json', expected, { fetch: get, wait: noWait, token: undefined })).rejects.toThrow(/the GitHub release copy: SHA-256 .*; Hugging Face \(without a token\): 429/)
  })
})
