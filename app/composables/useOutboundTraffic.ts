/**
 * Bytes this page has exchanged with any origin other than its own, measured
 * from the browser's own record of network requests (Resource Timing). The
 * Content-Security-Policy blocks such requests, so in Stage 1 this stays at 0;
 * the "What leaves your browser" indicator shows it so the promise can be checked.
 */
export function useOutboundTraffic() {
  const bytes = ref(0)
  const requests = ref(0)
  let observer: PerformanceObserver | undefined

  onMounted(() => {
    const count = (entries: PerformanceEntryList) => {
      for (const entry of entries as PerformanceResourceTiming[]) {
        if (new URL(entry.name, location.href).origin === location.origin) continue
        requests.value++
        bytes.value += entry.transferSize
      }
    }
    count(performance.getEntriesByType('resource'))
    observer = new PerformanceObserver(list => count(list.getEntries()))
    observer.observe({ type: 'resource' })
  })

  onBeforeUnmount(() => observer?.disconnect())

  return { bytes: readonly(bytes), requests: readonly(requests) }
}
