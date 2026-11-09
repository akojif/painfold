// Messages between the page and the detection worker. The handler is plain
// code so it can be tested without a browser; app/workers/detect.worker.ts
// only connects it to the worker's message events.
import { countByColumn, detectTable, type CellDetections, type ColumnCounts } from './table.ts'

// detect: every finding in the given columns, for review.
// survey: only how much personal data each column holds, so a column kept
// as is can be flagged before anything is reviewed.
export type DetectRequest = { kind: 'detect' | 'survey', id: number, rows: string[][], columns: number[] }

export type DetectResponse
  = | { kind: 'progress', id: number, done: number, total: number }
    | { kind: 'result', id: number, cells: CellDetections[] }
    | { kind: 'survey', id: number, columns: ColumnCounts[] }
    | { kind: 'error', id: number, message: string }

export function handleDetectRequest(request: DetectRequest, send: (response: DetectResponse) => void): void {
  try {
    const cells = detectTable(request.rows, request.columns, {
      onProgress: (done, total) => send({ kind: 'progress', id: request.id, done, total }),
    })
    if (request.kind === 'survey') send({ kind: 'survey', id: request.id, columns: countByColumn(cells) })
    else send({ kind: 'result', id: request.id, cells })
  }
  catch (error) {
    // Only the error message is sent back, never the text that was being scanned.
    send({ kind: 'error', id: request.id, message: error instanceof Error ? error.message : 'Detection failed' })
  }
}
