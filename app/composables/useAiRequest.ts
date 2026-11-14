import { classifyFailure, type AiProblem, type AiRequest, type Provider } from '~~/core/ai/providers'

export type AiAnswer = { ok: true, status: number, body: string } | { ok: false, problem: AiProblem, retryAfter?: number }

/**
 * The only way Painfold sends anything to an AI. It refuses any destination
 * but the chosen provider's, sends no cookies and no referrer, and logs every
 * request in "What leaves your browser" with the bytes sent. A failure comes
 * back as a problem to explain, never with the provider's text.
 */
export async function sendAiRequest(provider: Provider, request: AiRequest, signal?: AbortSignal): Promise<AiAnswer> {
  if (new URL(request.url).origin !== new URL(provider.endpoint).origin) throw new Error(`Refusing to send to ${new URL(request.url).origin}: the chosen AI is ${provider.name}`)
  const body = request.body ?? ''
  recordAiRequest(request.url, new TextEncoder().encode(body).length)
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal,
    })
    const text = await response.text()
    if (response.ok) return { ok: true, status: response.status, body: text }
    // How long the provider asks to wait, in seconds, when the browser may read it.
    const retryAfter = Number(response.headers.get('retry-after'))
    return { ok: false, problem: classifyFailure(response.status, text), ...(retryAfter > 0 ? { retryAfter } : {}) }
  }
  catch (error) {
    if (signal?.aborted) throw error
    return { ok: false, problem: classifyFailure(undefined, '') }
  }
}
