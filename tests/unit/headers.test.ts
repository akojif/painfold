import { describe, expect, it } from 'vitest'
import { AI_ENDPOINTS, assetPolicy, cloudflareHeaders, documentPolicy, headersFor } from '../../deploy/headers'

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

  it('lets a page talk to its own origin and to exactly the AI endpoints, nothing else', () => {
    expect(directive(policy, 'connect-src')).toEqual(["'self'", 'https://api.anthropic.com', 'http://localhost:11434', 'http://127.0.0.1:11434'])
    expect(AI_ENDPOINTS).toEqual(['https://api.anthropic.com', 'http://localhost:11434', 'http://127.0.0.1:11434'])
  })

  it('names no other host: apart from the AI endpoints in connect-src, every source is a keyword, a hash or data:', () => {
    for (const policy of [documentPolicy(['aaa=']), assetPolicy()]) {
      const sources = policy.split('; ').flatMap((part) => {
        const [name, ...values] = part.split(' ')
        return name === 'connect-src' ? values.filter(value => !AI_ENDPOINTS.includes(value)) : values
      })
      expect(sources.filter(source => !/^'[a-z-]+'$|^'sha256-[^']+'$|^data:$/.test(source)), policy).toEqual([])
    }
  })

  it('keeps app files and workers to this site: the AI is called from the page only', () => {
    expect(directive(assetPolicy(), 'connect-src')).toEqual(["'self'"])
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

// The paths every host config is checked on; /models/ only where a static rule serves it.
const PATHS = ['/', '/index.html', '/de/roadmap', '/_payload.json', '/_nuxt/entry.js', '/_nuxt/fonts/a.woff2', '/ort/1.0.0/ort-wasm-simd-threaded.wasm']

describe('Cloudflare _headers', () => {
  // Applied as Cloudflare documents it: every matching rule applies in order,
  // `! Name` removes a header, and a header set twice gets both values joined by ', '.
  function apply(file: string, path: string): Record<string, string> {
    const headers = new Map<string, string>()
    let matches = false
    for (const line of file.split('\n').filter(Boolean)) {
      if (!line.startsWith(' ')) {
        matches = new RegExp(`^${line.replaceAll('.', '\\.').replaceAll('*', '.*')}$`).test(path)
        continue
      }
      if (!matches) continue
      const entry = line.trim()
      if (entry.startsWith('! ')) {
        headers.delete(entry.slice(2))
        continue
      }
      const [name, value] = [entry.slice(0, entry.indexOf(':')), entry.slice(entry.indexOf(':') + 1).trim()]
      headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value)
    }
    return Object.fromEntries(headers)
  }

  it('gives every static path exactly the headers of headersFor', () => {
    for (const path of PATHS) expect(apply(cloudflareHeaders(), path), path).toEqual(headersFor(path))
  })

  it('stays inside Cloudflare\'s limits: 100 rules, 2,000 characters a line', () => {
    const lines = cloudflareHeaders().split('\n')
    expect(lines.filter(line => line && !line.startsWith(' ')).length).toBeLessThanOrEqual(100)
    expect(Math.max(...lines.map(line => line.length))).toBeLessThan(2000)
  })
})
