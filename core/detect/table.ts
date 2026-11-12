// Detection over a table's rows and columns. Kept only for the review, which
// still works on cells until it moves to items (#86, PR 3); the workers use
// items (items.ts).
import { detect, DETECTORS } from './index.ts'
import type { Detection, Detector } from './types.ts'

export type CellDetections = { row: number, column: number, detections: Detection[] }

/**
 * Runs detection over the given columns of every row, reporting progress after
 * each batch of rows. Only cells with at least one detection are returned.
 */
export function detectTable(
  rows: readonly (readonly string[])[],
  columns: readonly number[],
  options: { detectors?: readonly Detector[], onProgress?: (done: number, total: number) => void, batchSize?: number } = {},
): CellDetections[] {
  const { detectors = DETECTORS, onProgress, batchSize = 250 } = options
  const results: CellDetections[] = []
  for (const [row, cells] of rows.entries()) {
    for (const column of columns) {
      const detections = detect(cells[column] ?? '', detectors)
      if (detections.length > 0) results.push({ row, column, detections })
    }
    if (onProgress && ((row + 1) % batchSize === 0 || row + 1 === rows.length)) onProgress(row + 1, rows.length)
  }
  return results
}
