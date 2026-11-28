// Sends one request to the AI from Node, for the scripts that run real
// analyses (try:tagging, demo:generate), and answers in the shape the run
// code expects. Never logs the request: it holds the key.
import { classifyFailure, type AiRequest } from '../core/ai/providers.ts'
import type { BatchReply } from '../core/ai/run.ts'

export async function post(request: AiRequest): Promise<BatchReply> {
  try {
    const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body })
    const body = await response.text()
    if (response.ok) return { ok: true, body }
    const retryAfter = Number(response.headers.get('retry-after'))
    return { ok: false, problem: classifyFailure(response.status, body), ...(retryAfter > 0 ? { retryAfter } : {}) }
  }
  catch {
    return { ok: false, problem: 'unreachable' }
  }
}
