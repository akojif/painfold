// Messages between the page and the detection worker. The handlers are plain
// code so they can be tested without a browser; app/workers/detect.worker.ts
// only connects them to the worker's message events.
import { nameDetections, type ModelToken } from './names.ts'
import { countByColumn, detectTable, type CellDetections, type ColumnCounts } from './table.ts'

// detect: every finding in the given columns, for review.
// survey: only how much personal data each column holds, so a column kept
// as is can be flagged before anything is reviewed.
// names: names and places in the given columns, found by the name model.
// ortPath is where this build serves the ONNX Runtime WebAssembly files.
export type DetectRequest
  = | { kind: 'detect' | 'survey', id: number, rows: string[][], columns: number[] }
    | { kind: 'names', id: number, rows: string[][], columns: number[], ortPath: string }

export type DetectResponse
  = | { kind: 'progress', id: number, done: number, total: number }
    | { kind: 'model-progress', id: number, loaded: number, total: number }
    | { kind: 'result', id: number, cells: CellDetections[] }
    | { kind: 'survey', id: number, columns: ColumnCounts[] }
    | { kind: 'error', id: number, message: string }

// Only the error message is sent back, never the text that was being scanned.
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Detection failed')

export function handleDetectRequest(request: Extract<DetectRequest, { kind: 'detect' | 'survey' }>, send: (response: DetectResponse) => void): void {
  try {
    const cells = detectTable(request.rows, request.columns, {
      onProgress: (done, total) => send({ kind: 'progress', id: request.id, done, total }),
    })
    if (request.kind === 'survey') send({ kind: 'survey', id: request.id, columns: countByColumn(cells) })
    else send({ kind: 'result', id: request.id, cells })
  }
  catch (error) {
    send({ kind: 'error', id: request.id, message: errorMessage(error) })
  }
}

/** The name model as the worker sees it: load it once (reporting download progress), then label texts. */
export type NameModel = {
  load: (onProgress: (loaded: number, total: number) => void) => Promise<void>
  label: (text: string) => Promise<ModelToken[]>
}

const PROGRESS_EVERY = 50

/**
 * Finds names and places in the given columns. Identical texts are labelled
 * once, and cells without letters are skipped: they cannot hold a name.
 */
export async function handleNamesRequest(request: Extract<DetectRequest, { kind: 'names' }>, send: (response: DetectResponse) => void, model: NameModel): Promise<void> {
  try {
    await model.load((loaded, total) => send({ kind: 'model-progress', id: request.id, loaded, total }))
    const cells: CellDetections[] = []
    const seen = new Map<string, ReturnType<typeof nameDetections>>()
    for (const [row, values] of request.rows.entries()) {
      for (const column of request.columns) {
        const text = values[column] ?? ''
        if (!/\p{L}/u.test(text)) continue
        let detections = seen.get(text)
        if (!detections) {
          detections = nameDetections(text, await model.label(text))
          seen.set(text, detections)
        }
        if (detections.length > 0) cells.push({ row, column, detections: detections.map(found => ({ ...found })) })
      }
      if ((row + 1) % PROGRESS_EVERY === 0 || row + 1 === request.rows.length) send({ kind: 'progress', id: request.id, done: row + 1, total: request.rows.length })
    }
    send({ kind: 'result', id: request.id, cells })
  }
  catch (error) {
    send({ kind: 'error', id: request.id, message: errorMessage(error) })
  }
}
