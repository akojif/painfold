// The AI providers Painfold can send cleaned text to (Stage 3), as plain data
// and functions, so requests and errors are tested without a browser. What was
// checked about each provider, and why these: docs/ai-providers.md. Every
// endpoint here must also be in the pages' CSP (deploy/headers.ts).

export type ProviderId = 'anthropic' | 'ollama'

export type ModelChoice = { id: string, name: string }

export type Provider = {
  id: ProviderId
  name: string
  /** Where requests go: the provider's API, or Ollama on this computer. */
  endpoint: string
  /** Whether it needs the person's API key. */
  needsKey: boolean
}

export const ANTHROPIC: Provider = { id: 'anthropic', name: 'Anthropic', endpoint: 'https://api.anthropic.com', needsKey: true }
export const OLLAMA: Provider = { id: 'ollama', name: 'Ollama', endpoint: 'http://localhost:11434', needsKey: false }

/** Anthropic's models offered, the cheapest first: the default until the evaluation decides (#129). */
export const ANTHROPIC_MODELS: readonly ModelChoice[] = [
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
]

/** The only text a connection test sends: never feedback. */
export const TEST_TEXT = 'Hello'

export type AiRequest = { url: string, method: 'GET' | 'POST', headers: Record<string, string>, body?: string }

/** A one-message request to Anthropic's Messages API, straight from the browser. */
export function anthropicRequest(key: string, model: string, text: string, maxTokens = 16): AiRequest {
  return {
    url: `${ANTHROPIC.endpoint}/v1/messages`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // Anthropic answers browsers only with this header (docs/ai-providers.md).
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: text }] }),
  }
}

/** Ollama's list of installed models. */
export function ollamaModelsRequest(): AiRequest {
  return { url: `${OLLAMA.endpoint}/api/tags`, method: 'GET', headers: {} }
}

/** A one-message chat with a model in Ollama. */
export function ollamaRequest(model: string, text: string): AiRequest {
  return {
    url: `${OLLAMA.endpoint}/api/chat`,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, stream: false, messages: [{ role: 'user', content: text }] }),
  }
}

/** The names of the models in Ollama's answer to ollamaModelsRequest(). */
export function ollamaModels(answer: unknown): ModelChoice[] {
  const models = (answer as { models?: Array<{ name?: unknown }> } | null)?.models
  if (!Array.isArray(models)) return []
  return models.flatMap(model => (typeof model.name === 'string' ? [{ id: model.name, name: model.name }] : []))
}

/**
 * Why a request failed, in terms the interface can explain with a next step:
 * - unreachable: no answer at all. For Ollama: not running, not allowing this
 *   site (OLLAMA_ORIGINS), or the browser's local network permission refused.
 * - browserBlocked: the provider refuses browser calls for this key's
 *   organisation (an Anthropic organisation setting).
 * - invalidKey, noAccess, rateLimited, overloaded, modelMissing, other.
 */
export type AiProblem = 'unreachable' | 'browserBlocked' | 'invalidKey' | 'noAccess' | 'rateLimited' | 'overloaded' | 'modelMissing' | 'other'

/** Classifies a failed answer from its status and body; never returns or keeps the body. */
export function classifyFailure(status: number | undefined, body: string): AiProblem {
  if (status === undefined) return 'unreachable'
  if (status === 401 && /CORS requests are not allowed/i.test(body)) return 'browserBlocked'
  if (status === 401) return 'invalidKey'
  if (status === 403) return 'noAccess'
  if (status === 404) return 'modelMissing'
  if (status === 429) return 'rateLimited'
  if (status === 529 || status === 503 || status === 502) return 'overloaded'
  return 'other'
}
