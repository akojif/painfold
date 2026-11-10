/// <reference lib="webworker" />
import { handleNameRequest, type NameRequest, type NameResponse, type ResourceRecord } from '../../core/detect/worker-protocol'
import { nameModel } from './name-model'

const send = (response: NameResponse) => postMessage(response)

// A worker's requests are in its own Resource Timing, which the page cannot
// read; they are passed on so the network panel lists every request.
const report = (entries: PerformanceEntryList) => {
  const records: ResourceRecord[] = (entries as PerformanceResourceTiming[]).map(({ name, initiatorType, transferSize, encodedBodySize }) => ({ name, initiatorType, transferSize, encodedBodySize }))
  if (records.length > 0) send({ kind: 'resources', entries: records })
}
report(performance.getEntriesByType('resource'))
new PerformanceObserver(list => report(list.getEntries())).observe({ type: 'resource' })

addEventListener('message', (event: MessageEvent<NameRequest>) => {
  void handleNameRequest(event.data, send, nameModel(event.data.ortPath))
})
