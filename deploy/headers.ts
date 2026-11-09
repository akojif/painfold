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
// The local preview server and the generated vercel.json both use headersFor(),
// so moving to another host only needs a new adapter, not app changes.

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

/** The policy for app files, which covers Web Workers started from them. */
export function assetPolicy(): string {
  return serialize({ ...directives, 'frame-ancestors': ["'none'"] })
}

const commonHeaders: Record<string, string> = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Permissions-Policy': [
    'accelerometer=()', 'bluetooth=()', 'browsing-topics=()', 'camera=()', 'display-capture=()',
    'geolocation=()', 'gyroscope=()', 'hid=()', 'magnetometer=()', 'microphone=()', 'midi=()',
    'payment=()', 'publickey-credentials-get=()', 'serial=()', 'usb=()',
  ].join(', '),
}

export const ASSET_PREFIX = '/_nuxt/'

/** Response headers for a request path. */
export function headersFor(path: string): Record<string, string> {
  return {
    ...commonHeaders,
    'Content-Security-Policy': path.startsWith(ASSET_PREFIX) ? assetPolicy() : "frame-ancestors 'none'",
  }
}

type VercelHeaderRule = { source: string, headers: Array<{ key: string, value: string }> }

function toVercelHeaders(headers: Record<string, string>) {
  return Object.entries(headers).map(([key, value]) => ({ key, value }))
}

/** vercel.json content; the two sources split paths exactly as headersFor() does. */
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
      { source: '/((?!_nuxt/).*)', headers: toVercelHeaders(headersFor('/')) },
      { source: '/_nuxt/(.*)', headers: toVercelHeaders(headersFor(`${ASSET_PREFIX}entry.js`)) },
    ],
  }
}
