// Detection over feedback items (#86): each item is a piece of text with an id,
// and the result says which detections belong to which item. Where the text
// came from (a cell, later a transcript turn) is the adapter's business.
import type { PiiType } from '../pii-types.ts'
import { detect, DETECTORS } from './index.ts'
import type { Detection, Detector } from './types.ts'

/** What the workers get: the text, its id, and the unit it belongs to, which progress counts. */
export type TextItem = { id: string, text: string, unit?: string }

export type ItemDetections = { id: string, detections: Detection[] }

/** How much of each type of personal data an item holds: only counts, never the values. */
export type ItemCounts = { id: string, counts: Partial<Record<PiiType, number>> }

/**
 * Calls onProgress(done, total) after every `every` units and after the last
 * one, counting units (table rows), so progress reads the same however many
 * columns are checked. Items without a unit count one each. Items must be in
 * reading order, with a unit's items together.
 */
export function unitProgress(items: readonly TextItem[], every: number, onProgress?: (done: number, total: number) => void): (index: number) => void {
  const unitOf = (item: TextItem) => item.unit ?? item.id
  const total = new Set(items.map(unitOf)).size
  let done = 0
  return (index) => {
    const item = items[index]!
    const next = items[index + 1]
    if (next && unitOf(next) === unitOf(item)) return
    done++
    if (onProgress && (done % every === 0 || done === total)) onProgress(done, total)
  }
}

/** Every finding in every item, reporting progress by unit. Only items with at least one finding are returned. */
export function detectItems(
  items: readonly TextItem[],
  options: { detectors?: readonly Detector[], onProgress?: (done: number, total: number) => void, batchSize?: number } = {},
): ItemDetections[] {
  const { detectors = DETECTORS, onProgress, batchSize = 250 } = options
  const progress = unitProgress(items, batchSize, onProgress)
  const results: ItemDetections[] = []
  for (const [index, item] of items.entries()) {
    const detections = detect(item.text, detectors)
    if (detections.length > 0) results.push({ id: item.id, detections })
    progress(index)
  }
  return results
}

/** Counts per item and type, for the column step's warnings: never the values themselves. */
export function countTypes(results: readonly ItemDetections[]): ItemCounts[] {
  return results.map(({ id, detections }) => {
    const counts: Partial<Record<PiiType, number>> = {}
    for (const { type } of detections) counts[type] = (counts[type] ?? 0) + 1
    return { id, counts }
  })
}
