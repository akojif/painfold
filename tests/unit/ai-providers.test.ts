import { describe, expect, it } from 'vitest'
import { AI_ENDPOINTS } from '../../deploy/headers'
import { ANTHROPIC, ANTHROPIC_MODELS, anthropicRequest, classifyFailure, OLLAMA, ollamaModels, ollamaModelsRequest, ollamaRequest, TEST_TEXT } from '../../core/ai/providers'

describe('AI providers', () => {
  it('only ever calls endpoints the pages\' CSP allows', () => {
    for (const request of [anthropicRequest('k', 'm', 'x'), ollamaModelsRequest(), ollamaRequest('m', 'x')]) {
      expect(AI_ENDPOINTS, request.url).toContain(new URL(request.url).origin)
    }
    for (const provider of [ANTHROPIC, OLLAMA]) expect(AI_ENDPOINTS).toContain(provider.endpoint)
  })

  it('builds Anthropic requests with the key, the API version and the browser header', () => {
    const request = anthropicRequest('sk-ant-invented', 'claude-haiku-5-5', TEST_TEXT)
    expect(request).toMatchObject({ url: 'https://api.anthropic.com/v1/messages', method: 'POST' })
    expect(request.headers).toEqual({
      'content-type': 'application/json',
      'x-api-key': 'sk-ant-invented',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    })
    expect(JSON.parse(request.body!)).toEqual({ model: 'claude-haiku-5-5', max_tokens: 16, messages: [{ role: 'user', content: 'Hello' }] })
  })

  it('offers Claude Haiku 5.5 first, as the default', () => {
    expect(ANTHROPIC_MODELS[0]).toEqual({ id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5' })
  })

  it('builds Ollama requests to this computer, without a key', () => {
    expect(ollamaModelsRequest()).toEqual({ url: 'http://localhost:11434/api/tags', method: 'GET', headers: {} })
    expect(JSON.parse(ollamaRequest('llama3.2:3b', TEST_TEXT).body!)).toEqual({ model: 'llama3.2:3b', stream: false, messages: [{ role: 'user', content: 'Hello' }] })
  })

  it('reads the model names from Ollama\'s answer, ignoring anything else', () => {
    expect(ollamaModels({ models: [{ name: 'llama3.2:3b' }, { name: 3 }, {}] })).toEqual([{ id: 'llama3.2:3b', name: 'llama3.2:3b' }])
    expect(ollamaModels(null)).toEqual([])
    expect(ollamaModels({ models: 'nope' })).toEqual([])
  })

  it('turns failures into problems the interface can explain', () => {
    expect(classifyFailure(undefined, '')).toBe('unreachable')
    expect(classifyFailure(401, '{"error":{"message":"CORS requests are not allowed for this Organization because of its settings"}}')).toBe('browserBlocked')
    expect(classifyFailure(401, '{"error":{"type":"authentication_error"}}')).toBe('invalidKey')
    expect(classifyFailure(403, '')).toBe('noAccess')
    expect(classifyFailure(404, '')).toBe('modelMissing')
    expect(classifyFailure(429, '')).toBe('rateLimited')
    expect(classifyFailure(529, '')).toBe('overloaded')
    expect(classifyFailure(500, '')).toBe('other')
  })
})
