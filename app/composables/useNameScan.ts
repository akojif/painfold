import { textItems, toCellDetections } from '~~/core/items/table'
import { NameModelStopped } from './useNameModel'

// Finding names and places in the background while the rule findings are
// reviewed. It starts when a review starts and the name model is ready, or as
// soon as the model becomes ready during the review. Rows go to the names
// worker in batches; each batch's names and places are added to the review in
// one change, so counts move every second or so, not with every row, and
// nothing the user is doing (selection, focus, decisions) is touched.
//
// waiting: the review has started but the model is not ready (not downloaded,
// or on its way). running: rows are being checked. done: every row was
// checked. skipped: the user stopped it; names are not removed from the
// download. failed: the model could not run.
export type NameScanStatus = 'idle' | 'waiting' | 'running' | 'done' | 'skipped' | 'failed'

const BATCH = 100

const status = ref<NameScanStatus>('idle')
const done = ref(0)
const total = ref(0)
const found = ref({ names: 0, places: 0 })
// Each scan gets a number; a scan that is no longer the current one stops.
let current = 0
let watching = false

export function useNameScan() {
  const session = useSession()
  const model = useNameModel()
  // Names are not checked on a small screen (useSmallScreen): the model is never offered there.
  const { narrow } = useSmallScreen()

  async function run() {
    const review = session.review.value
    const set = session.items.value
    if (!review || !set || status.value === 'running') return
    const scan = ++current
    status.value = 'running'
    done.value = 0
    total.value = set.units.length
    found.value = { names: 0, places: 0 }
    // The items in batches of BATCH units (rows), so progress counts rows as before.
    const byUnit = new Map<string, typeof set.items>()
    for (const item of set.items) byUnit.set(item.unit, [...(byUnit.get(item.unit) ?? []), item])
    try {
      for (let start = 0; start < set.units.length; start += BATCH) {
        const batch = set.units.slice(start, start + BATCH).flatMap(unit => byUnit.get(unit.id) ?? [])
        const results = await model.names(textItems(batch))
        if (scan !== current || session.review.value !== review) return
        session.change(current => current.addDetected(toCellDetections(batch, results)))
        done.value = Math.min(start + BATCH, set.units.length)
      }
      // Counted from the review, so a check that is run again after skipping counts every name once.
      const detected = review.findings.filter(finding => finding.source === 'detected')
      found.value = { names: detected.filter(finding => finding.type === 'NAME').length, places: detected.filter(finding => finding.type === 'PLACE').length }
      status.value = 'done'
    }
    catch (error) {
      if (scan !== current) return
      status.value = error instanceof NameModelStopped ? 'skipped' : 'failed'
    }
  }

  /** A new review: names are checked now if the model is ready, or as soon as it is. */
  function begin() {
    current++
    status.value = 'waiting'
    done.value = 0
    found.value = { names: 0, places: 0 }
    if (model.status.value === 'ready' && !narrow.value) void run()
  }

  /** Skips names for this file: stops the check (or the model's download) and keeps what was found so far. */
  function skip() {
    current++
    if (model.status.value === 'downloading') void model.cancel()
    else model.stop()
    status.value = 'skipped'
  }

  function reset() {
    if (status.value === 'running') model.stop()
    current++
    status.value = 'idle'
  }

  // Once per visit: follow the session (a new review starts a scan, a cleared
  // one stops it) and start a waiting scan as soon as the model is ready.
  if (!watching && import.meta.client) {
    watching = true
    effectScope(true).run(() => {
      watch(session.review, (now, before) => {
        // Changes to the same review (decisions, arriving names) are not a new review.
        if (now === before) return
        if (now) begin()
        else reset()
      })
      watch(model.status, (now) => {
        if (now === 'ready' && status.value === 'waiting' && !narrow.value) void run()
      })
    })
    // A review that already started before anything asked about names.
    if (session.review.value && status.value === 'idle') begin()
  }

  // The download waits while names are checked, or while the model they need is on its way.
  const busy = computed(() => status.value === 'running' || (status.value === 'waiting' && model.status.value === 'downloading'))

  return { status: readonly(status), done: readonly(done), total: readonly(total), found: readonly(found), busy, run, skip }
}
