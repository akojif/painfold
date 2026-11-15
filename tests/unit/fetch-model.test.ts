import { describe, expect, it } from 'vitest'
import { fetchWithRetry } from '../../scripts/fetch-model'

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
