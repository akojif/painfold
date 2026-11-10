import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assetPolicy, documentPolicy, headersFor, vercelConfig } from '../../deploy/headers'

function directive(policy: string, name: string): string[] {
  const entry = policy.split('; ').find(part => part.startsWith(`${name} `))
  return entry ? entry.split(' ').slice(1) : []
}

describe('documentPolicy', () => {
  const policy = documentPolicy(['bbb=', 'aaa=', 'bbb='])

  it('denies everything by default', () => {
    expect(directive(policy, 'default-src')).toEqual(["'none'"])
    expect(directive(policy, 'object-src')).toEqual(["'none'"])
    expect(directive(policy, 'base-uri')).toEqual(["'none'"])
    expect(directive(policy, 'form-action')).toEqual(["'none'"])
  })

  it('only lets the page talk to its own origin', () => {
    expect(directive(policy, 'connect-src')).toEqual(["'self'"])
  })

  it('allows inline scripts only by hash, sorted and without duplicates', () => {
    expect(directive(policy, 'script-src')).toEqual(["'self'", "'sha256-aaa='", "'sha256-bbb='"])
    expect(policy).not.toContain('unsafe-inline')
    expect(policy).not.toContain('unsafe-eval')
  })
})

describe('headersFor', () => {
  it('sends the security headers on every path', () => {
    for (const path of ['/', '/index.html', '/_nuxt/entry.js']) {
      const headers = headersFor(path)
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
      expect(headers['Referrer-Policy']).toBe('no-referrer')
      expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin')
      expect(headers['Permissions-Policy']).toContain('camera=()')
    }
  })

  it('forbids framing pages, leaving the rest of their policy to the meta tag', () => {
    expect(headersFor('/')['Content-Security-Policy']).toBe("frame-ancestors 'none'")
  })

  it('makes every page cross-origin isolated, for WebAssembly threads', () => {
    for (const path of ['/', '/de/review', '/_nuxt/entry.js', '/ort/1.0.0/ort-wasm-simd-threaded.mjs', '/models/m/r/onnx/model_int8.onnx']) {
      expect(headersFor(path)['Cross-Origin-Embedder-Policy'], path).toBe('require-corp')
      expect(headersFor(path)['Cross-Origin-Opener-Policy'], path).toBe('same-origin')
    }
  })

  it('allows compiling WebAssembly only in app code and the runtime, never on pages, and never eval', () => {
    expect(directive(assetPolicy(), 'script-src')).toEqual(["'self'", "'wasm-unsafe-eval'"])
    expect(headersFor('/ort/1.0.0/ort-wasm-simd-threaded.mjs')['Content-Security-Policy']).toBe(assetPolicy())
    expect(directive(documentPolicy([]), 'script-src')).toEqual(["'self'"])
    expect(assetPolicy()).not.toContain("'unsafe-eval'")
  })

  it('lets browsers keep the model and the runtime for good, under their versioned paths', () => {
    expect(headersFor('/models/m/r/onnx/model_int8.onnx')['Cache-Control']).toBe('public, max-age=31536000, immutable')
    expect(headersFor('/ort/1.0.0/ort-wasm-simd-threaded.wasm')['Cache-Control']).toBe('public, max-age=31536000, immutable')
    expect(headersFor('/')['Cache-Control']).toBeUndefined()
    expect(headersFor('/_nuxt/entry.js')['Cache-Control']).toBeUndefined()
  })

  it('gives app files the full policy, which Web Workers inherit from their response', () => {
    expect(headersFor('/_nuxt/worker.js')['Content-Security-Policy']).toBe(assetPolicy())
    expect(directive(assetPolicy(), 'connect-src')).toEqual(["'self'"])
    expect(directive(assetPolicy(), 'frame-ancestors')).toEqual(["'none'"])
  })
})

describe('vercel.json', () => {
  it('is up to date with deploy/headers.ts (run `npm run headers:vercel`)', () => {
    const committed = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
    expect(committed).toEqual(vercelConfig())
  })

  it('splits paths the same way as headersFor', () => {
    const rules = vercelConfig().headers.map(rule => ({ pattern: new RegExp(`^${rule.source}$`), rule }))
    for (const path of ['/', '/index.html', '/de/roadmap', '/_payload.json', '/_nuxt/entry.js', '/_nuxt/fonts/a.woff2', '/ort/1.0.0/ort-wasm-simd-threaded.wasm', '/models/m/r/onnx/model_int8.onnx']) {
      const matching = rules.filter(({ pattern }) => pattern.test(path))
      expect(matching, path).toHaveLength(1)
      const headers = Object.fromEntries(matching[0]!.rule.headers.map(header => [header.key, header.value]))
      expect(headers, path).toEqual(headersFor(path))
    }
  })
})
