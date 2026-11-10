import type { ResourceRecord } from '~~/core/detect/worker-protocol'

// stored: read from the browser's own storage, nothing was transferred.
export type NetworkEntry = { url: string, host: string, own: boolean, kind: 'code' | 'style' | 'font' | 'data' | 'model' | 'runtime' | 'other', bytes: number, stored: boolean }

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
  const added = list.map((entry) => {
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

/** Adds requests a worker made, which the page's own record does not include. */
export function recordWorkerRequests(list: readonly ResourceRecord[]) {
  record(list)
}

/**
 * The page's network requests, so the promise "your file is never uploaded"
 * can be checked rather than taken on trust. Requests to other sites are
 * blocked by the Content-Security-Policy, so `foreign` stays empty in Stage 1.
 */
export function useNetworkLog() {
  onMounted(() => {
    if (observer) return
    record(performance.getEntriesByType('resource') as PerformanceResourceTiming[])
    observer = new PerformanceObserver(list => record(list.getEntries() as PerformanceResourceTiming[]))
    observer.observe({ type: 'resource' })
  })

  const foreign = computed(() => entries.value.filter(entry => !entry.own))
  const foreignBytes = computed(() => foreign.value.reduce((sum, entry) => sum + entry.bytes, 0))
  return { entries: readonly(entries), foreign, foreignBytes }
}
