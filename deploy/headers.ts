// Single source of truth for Painfold's Content-Security-Policy and security headers.
//
// The policy reaches the browser in two ways:
// - Each generated HTML page gets the full policy as a <meta> tag, including
//   hashes of that build's inline scripts (scripts/apply-csp.ts). The hashes
//   change with every build, so they cannot live in static host config.
// - Static response headers carry what a <meta> policy cannot: frame-ancestors,
//   the other security headers, and the full policy for files under /_nuxt/,
//   because a Web Worker takes its policy from its own response headers.
//
// The local preview server, the generated vercel.json, Cloudflare's _headers
// file and the Cloudflare Worker that serves the model all use headersFor(),
// so moving to another host only needs a new adapter, not app changes.

import { ORT_PREFIX } from './model.ts'

type Directives = Record<string, string[]>

// Stage 1 makes no network requests beyond the app's own files.
const directives: Directives = {
  'default-src': ["'none'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'object-src': ["'none'"],
}

function serialize(policy: Directives): string {
  return Object.entries(policy).map(([name, values]) => [name, ...values].join(' ')).join('; ')
}

/** The policy for HTML pages, delivered in a <meta> tag. */
export function documentPolicy(scriptHashes: string[]): string {
  const hashes = [...new Set(scriptHashes)].sort().map(hash => `'sha256-${hash}'`)
  return serialize({ ...directives, 'script-src': [...directives['script-src']!, ...hashes] })
}

/**
 * The policy for app files, which covers Web Workers started from them. It also
 * allows compiling WebAssembly ('wasm-unsafe-eval', not 'unsafe-eval'): the name
 * model runs in ONNX Runtime's WebAssembly build inside the detection worker.
 * Pages themselves never compile WebAssembly, so their policy does not allow it.
 */
export function assetPolicy(): string {
  return serialize({ ...directives, 'script-src': [...directives['script-src']!, "'wasm-unsafe-eval'"], 'frame-ancestors': ["'none'"] })
}

const commonHeaders: Record<string, string> = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  // Together these make every page cross-origin isolated, which WebAssembly threads
  // need (SharedArrayBuffer): the name model runs about 4 times faster with them.
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Permissions-Policy': [
    'accelerometer=()', 'bluetooth=()', 'browsing-topics=()', 'camera=()', 'display-capture=()',
    'geolocation=()', 'gyroscope=()', 'hid=()', 'magnetometer=()', 'microphone=()', 'midi=()',
    'payment=()', 'publickey-credentials-get=()', 'serial=()', 'usb=()',
  ].join(', '),
}

export const ASSET_PREFIX = '/_nuxt/'
export const RUNTIME_PREFIX = ORT_PREFIX
export const MODEL_PREFIX = '/models/'

// Code that runs in the browser, including ONNX Runtime's files, which start their own worker threads.
const CODE_PREFIXES = [ASSET_PREFIX, RUNTIME_PREFIX]
// Served under a versioned path that changes with every new file, so browsers may keep them for good.
const IMMUTABLE_PREFIXES = [MODEL_PREFIX, RUNTIME_PREFIX]

/** Response headers for a request path. */
export function headersFor(path: string): Record<string, string> {
  return {
    ...commonHeaders,
    'Content-Security-Policy': CODE_PREFIXES.some(prefix => path.startsWith(prefix)) ? assetPolicy() : "frame-ancestors 'none'",
    ...(IMMUTABLE_PREFIXES.some(prefix => path.startsWith(prefix)) ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : {}),
  }
}

/**
 * Cloudflare's _headers file, written into the build by scripts/write-cloudflare-assets.ts.
 * Every rule that matches a path applies, and a header set by two rules gets
 * both values joined by a comma, so app files and the runtime first remove the
 * page policy (`! Name`) and then set their own. The model is not covered: the
 * Worker serves it from R2 (deploy/worker.ts) and sets headersFor() itself.
 */
export function cloudflareHeaders(): string {
  const page = headersFor('/')
  const rules: Array<[string, Record<string, string>]> = [
    ['/*', page],
    [`${ASSET_PREFIX}*`, changedFrom(page, headersFor(`${ASSET_PREFIX}entry.js`))],
    [`${RUNTIME_PREFIX}*`, changedFrom(page, headersFor(`${RUNTIME_PREFIX}runtime.wasm`))],
  ]
  return rules.map(([path, headers]) => [
    path,
    ...Object.entries(headers).flatMap(([name, value]) => name in page && page[name] !== value ? [`  ! ${name}`, `  ${name}: ${value}`] : [`  ${name}: ${value}`]),
  ].join('\n')).join('\n') + '\n'
}

/** The headers of `headers` that differ from (or are missing in) `base`. */
function changedFrom(base: Record<string, string>, headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name, value]) => base[name] !== value))
}

type VercelHeaderRule = { source: string, headers: Array<{ key: string, value: string }> }

function toVercelHeaders(headers: Record<string, string>) {
  return Object.entries(headers).map(([key, value]) => ({ key, value }))
}

/** vercel.json content; the sources split paths exactly as headersFor() does, one rule per path. */
// Vercel builds the static site the same way as everywhere else: no framework
// preset (which would run its own Nuxt build without the CSP step), our own
// build command, and the generated folder as the output.
export function vercelConfig(): { $schema: string, framework: null, installCommand: string, buildCommand: string, outputDirectory: string, headers: VercelHeaderRule[] } {
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    framework: null,
    installCommand: 'npm ci',
    buildCommand: 'NUXT_TELEMETRY_DISABLED=1 npm run generate',
    outputDirectory: '.output/public',
    headers: [
      { source: '/((?!_nuxt/|ort/|models/).*)', headers: toVercelHeaders(headersFor('/')) },
      { source: '/_nuxt/(.*)', headers: toVercelHeaders(headersFor(`${ASSET_PREFIX}entry.js`)) },
      { source: '/ort/(.*)', headers: toVercelHeaders(headersFor(`${RUNTIME_PREFIX}runtime.wasm`)) },
      { source: '/models/(.*)', headers: toVercelHeaders(headersFor(`${MODEL_PREFIX}model.onnx`)) },
    ],
  }
}
