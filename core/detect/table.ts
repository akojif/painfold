import type { PiiType } from '../pii-types.ts'
import { detect, DETECTORS } from './index.ts'
import type { Detection, Detector } from './types.ts'

export type CellDetections = { row: number, column: number, detections: Detection[] }

/** How much of each type of personal data a column holds. */
export type ColumnCounts = { column: number, counts: Partial<Record<PiiType, number>> }

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

/** Adds up detections per column and type: only counts, never the values themselves. */
export function countByColumn(cells: readonly CellDetections[]): ColumnCounts[] {
  const byColumn = new Map<number, Partial<Record<PiiType, number>>>()
  for (const { column, detections } of cells) {
    const counts = byColumn.get(column) ?? {}
    for (const { type } of detections) counts[type] = (counts[type] ?? 0) + 1
    byColumn.set(column, counts)
  }
  return [...byColumn].map(([column, counts]) => ({ column, counts }))
}
