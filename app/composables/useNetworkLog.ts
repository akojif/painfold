import type { ResourceRecord } from '~~/core/detect/worker-protocol'
import { AI_ENDPOINTS } from '~~/deploy/headers'

// stored: read from the browser's own storage, nothing was transferred.
// ai: a request to the AI the person chose; bytes is what was sent to it.
export type NetworkEntry = { url: string, host: string, own: boolean, kind: 'code' | 'style' | 'font' | 'data' | 'model' | 'runtime' | 'other' | 'ai', bytes: number, stored: boolean }

const AI_ORIGINS = new Set(AI_ENDPOINTS.map(endpoint => new URL(endpoint).origin))

// Every request this page has made, from the browser's own record (Resource
// Timing), kept for the whole visit and shared by the header and the panel.
// Workers keep their own record, so the name model's worker passes its
// requests on (recordWorkerRequests).
const entries = shallowRef<NetworkEntry[]>([])
let observer: PerformanceObserver | undefined

function kindOf(entry: ResourceRecord, path: string): NetworkEntry['kind'] {
  if (path.startsWith('/models/')) return 'model'
  if (path.startsWith('/ort/')) return 'runtime'
  if (/\.(?:woff2?|ttf|otf)$/.test(path)) return 'font'
  if (/\.css$/.test(path)) return 'style'
  if (/\.m?js$/.test(path) || entry.initiatorType === 'script') return 'code'
  if (/\.json$/.test(path) || entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') return 'data'
  return 'other'
}

function record(list: readonly ResourceRecord[]) {
  // Requests to the AI are logged by the code that makes them (recordAiRequest):
  // the browser's record cannot see their size, so it would show them as 0 bytes.
  const added = list.filter(entry => !AI_ORIGINS.has(new URL(entry.name, location.href).origin)).map((entry) => {
    const url = new URL(entry.name, location.href)
    const own = url.origin === location.origin
    return {
      url: own ? url.pathname : url.href,
      host: url.host,
      own,
      kind: kindOf(entry, url.pathname),
      bytes: entry.transferSize || entry.encodedBodySize,
      stored: own && entry.transferSize === 0 && entry.encodedBodySize > 0,
    }
  })
  if (added.length > 0) entries.value = [...entries.value, ...added]
}

/**
 * Logs a request to the AI the person chose, made by Painfold's own request
 * code (useAiRequest): where it went and how many bytes were sent.
 */
export function recordAiRequest(url: string, bytesSent: number) {
  const target = new URL(url)
  entries.value = [...entries.value, { url: target.href, host: target.host, own: false, kind: 'ai', bytes: bytesSent, stored: false }]
}

/** Adds requests a worker made, which the page's own record does not include. */
export function recordWorkerRequests(list: readonly ResourceRecord[]) {
  record(list)
}

/**
 * The page's network requests, so the promise "your file is never uploaded"
 * can be checked rather than taken on trust. `ai` holds the requests to the AI
 * the person chose; `foreign` holds any other request to another site, which
 * the Content-Security-Policy blocks, so it stays empty.
 */
export function useNetworkLog() {
  onMounted(() => {
    if (observer) return
    record(performance.getEntriesByType('resource') as PerformanceResourceTiming[])
    observer = new PerformanceObserver(list => record(list.getEntries() as PerformanceResourceTiming[]))
    observer.observe({ type: 'resource' })
  })

  const ai = computed(() => entries.value.filter(entry => entry.kind === 'ai'))
  const foreign = computed(() => entries.value.filter(entry => !entry.own && entry.kind !== 'ai'))
  // What left this browser: everything sent to the AI, and anything that went elsewhere.
  const sentBytes = computed(() => [...ai.value, ...foreign.value].reduce((sum, entry) => sum + entry.bytes, 0))
  return { entries: readonly(entries), ai, foreign, sentBytes }
}
