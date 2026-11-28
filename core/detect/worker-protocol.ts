// Messages between the page and the two detection workers. The handlers are
// plain code so they can be tested without a browser; app/workers/ only
// connects them to the workers' message events.
//
// The rules run in detect.worker.ts. The name model runs in names.worker.ts on
// its own, so a download can be cancelled by stopping that worker while the
// rules keep working.
import { chunkText, mergeOverlapping } from './chunks.ts'
import { withNameRules } from './name-cues.ts'
import { nameDetections, type ModelToken } from './names.ts'
import { countTypes, detectItems, unitProgress, type ItemCounts, type ItemDetections, type TextItem } from './items.ts'
import type { Detection } from './types.ts'

// Both workers get feedback items (core/items/): texts with ids, and the unit
// each belongs to, which progress counts. They never see rows or columns.
// detect: every finding in the items, for review.
// survey: only how much personal data each item holds, so a column kept as is
// can be flagged before anything is reviewed.
export type DetectRequest = { kind: 'detect' | 'survey', id: number, items: TextItem[] }

export type DetectResponse
  = | { kind: 'progress', id: number, done: number, total: number }
    | { kind: 'result', id: number, items: ItemDetections[] }
    | { kind: 'survey', id: number, counts: ItemCounts[] }
    | { kind: 'error', id: number, message: string }

// load: download the name model (or open it from the browser's cache).
// names: names and places in the items, loading the model first if needed.
// ortPath is where this build serves the ONNX Runtime WebAssembly files.
// firstNames: false leaves out the first-name list, only to measure what it adds (scripts/eval-names.ts).
export type NameRequest
  = | { kind: 'load', id: number, ortPath: string }
    | { kind: 'names', id: number, items: TextItem[], ortPath: string, firstNames?: boolean }

// resources: the requests the worker made, for the "What leaves your browser"
// panel, which cannot see a worker's requests on its own.
export type NameResponse
  = | { kind: 'model-progress', id: number, loaded: number }
    | { kind: 'loaded', id: number }
    | { kind: 'progress', id: number, done: number, total: number }
    | { kind: 'result', id: number, items: ItemDetections[] }
    | { kind: 'error', id: number, message: string }
    | { kind: 'resources', entries: ResourceRecord[] }

/** A request from the browser's Resource Timing, reduced to what the network panel shows. */
export type ResourceRecord = { name: string, initiatorType: string, transferSize: number, encodedBodySize: number }

// Only the error message is sent back, never the text that was being scanned.
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Detection failed')

export function handleDetectRequest(request: DetectRequest, send: (response: DetectResponse) => void): void {
  try {
    const items = detectItems(request.items, {
      onProgress: (done, total) => send({ kind: 'progress', id: request.id, done, total }),
    })
    if (request.kind === 'survey') send({ kind: 'survey', id: request.id, counts: countTypes(items) })
    else send({ kind: 'result', id: request.id, items })
  }
  catch (error) {
    send({ kind: 'error', id: request.id, message: errorMessage(error) })
  }
}

/**
 * The name model as the worker sees it: load it once (reporting bytes
 * downloaded so far), then label texts. fits says whether a text is short
 * enough for the model to read whole; longer texts are labelled in chunks.
 */
export type NameModel = {
  fits: (text: string) => boolean
  load: (onProgress: (loaded: number) => void) => Promise<void>
  label: (text: string) => Promise<ModelToken[]>
}

const PROGRESS_EVERY = 50

/** The model's names and places in a text of any length: chunk by chunk, mapped back to the whole text. */
async function modelDetections(text: string, model: NameModel): Promise<Detection[]> {
  const found: Detection[] = []
  for (const chunk of chunkText(text, model.fits)) {
    const piece = text.slice(chunk.start, chunk.end)
    for (const detection of nameDetections(piece, await model.label(piece))) found.push({ ...detection, start: detection.start + chunk.start, end: detection.end + chunk.start })
  }
  return mergeOverlapping(text, found)
}

/**
 * Loads the name model; for a names request, then finds names and places in
 * the items, with the model and the cue rules together (name-cues.ts).
 * Identical texts are labelled once, and items without letters are skipped:
 * they cannot hold a name. Progress counts units, as for the rules.
 */
export async function handleNameRequest(request: NameRequest, send: (response: NameResponse) => void, model: NameModel): Promise<void> {
  try {
    await model.load(loaded => send({ kind: 'model-progress', id: request.id, loaded }))
    if (request.kind === 'load') {
      send({ kind: 'loaded', id: request.id })
      return
    }
    const results: ItemDetections[] = []
    const seen = new Map<string, ReturnType<typeof nameDetections>>()
    const firstNames = request.firstNames ?? true
    const progress = unitProgress(request.items, PROGRESS_EVERY, (done, total) => send({ kind: 'progress', id: request.id, done, total }))
    for (const [index, { id, text }] of request.items.entries()) {
      if (/\p{L}/u.test(text)) {
        let detections = seen.get(text)
        if (!detections) {
          detections = withNameRules(text, await modelDetections(text, model), { firstNames })
          seen.set(text, detections)
        }
        if (detections.length > 0) results.push({ id, detections: detections.map(found => ({ ...found })) })
      }
      progress(index)
    }
    send({ kind: 'result', id: request.id, items: results })
  }
  catch (error) {
    send({ kind: 'error', id: request.id, message: errorMessage(error) })
  }
}
