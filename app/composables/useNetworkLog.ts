export type NetworkEntry = { url: string, host: string, own: boolean, kind: 'code' | 'style' | 'font' | 'data' | 'other', bytes: number }

// Every request this page has made, from the browser's own record (Resource
// Timing), kept for the whole visit and shared by the header and the panel.
const entries = shallowRef<NetworkEntry[]>([])
let observer: PerformanceObserver | undefined

function kindOf(entry: PerformanceResourceTiming): NetworkEntry['kind'] {
  const path = new URL(entry.name, location.href).pathname
  if (/\.(?:woff2?|ttf|otf)$/.test(path)) return 'font'
  if (/\.css$/.test(path)) return 'style'
  if (/\.m?js$/.test(path) || entry.initiatorType === 'script') return 'code'
  if (/\.json$/.test(path) || entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') return 'data'
  return 'other'
}

function record(list: PerformanceEntryList) {
  const added = (list as PerformanceResourceTiming[]).map((entry) => {
    const url = new URL(entry.name, location.href)
    return {
      url: url.origin === location.origin ? url.pathname : url.href,
      host: url.host,
      own: url.origin === location.origin,
      kind: kindOf(entry),
      bytes: entry.transferSize || entry.encodedBodySize,
    }
  })
  if (added.length > 0) entries.value = [...entries.value, ...added]
}

/**
 * The page's network requests, so the promise "your file is never uploaded"
 * can be checked rather than taken on trust. Requests to other sites are
 * blocked by the Content-Security-Policy, so `foreign` stays empty in Stage 1.
 */
export function useNetworkLog() {
  onMounted(() => {
    if (observer) return
    record(performance.getEntriesByType('resource'))
    observer = new PerformanceObserver(list => record(list.getEntries()))
    observer.observe({ type: 'resource' })
  })

  const foreign = computed(() => entries.value.filter(entry => !entry.own))
  const foreignBytes = computed(() => foreign.value.reduce((sum, entry) => sum + entry.bytes, 0))
  return { entries: readonly(entries), foreign, foreignBytes }
}
