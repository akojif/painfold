// Messages between the page and the detection worker. The handler is plain
// code so it can be tested without a browser; app/workers/detect.worker.ts
// only connects it to the worker's message events.
import { detectTable, type CellDetections } from './table.ts'

export type DetectRequest = { kind: 'detect', id: number, rows: string[][], columns: number[] }

export type DetectResponse
  = | { kind: 'progress', id: number, done: number, total: number }
    | { kind: 'result', id: number, cells: CellDetections[] }
    | { kind: 'error', id: number, message: string }

export function handleDetectRequest(request: DetectRequest, send: (response: DetectResponse) => void): void {
  try {
    const cells = detectTable(request.rows, request.columns, {
      onProgress: (done, total) => send({ kind: 'progress', id: request.id, done, total }),
    })
    send({ kind: 'result', id: request.id, cells })
  }
  catch (error) {
    // Only the error message is sent back, never the text that was being scanned.
    send({ kind: 'error', id: request.id, message: error instanceof Error ? error.message : 'Detection failed' })
  }
}
