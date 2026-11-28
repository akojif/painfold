// Builds reviews for unit tests through the real path: a table's checked
// columns become feedback items (core/items/table.ts), detection runs on them,
// and the review gets the items and their detections.
import type { ColumnRole } from '../../core/columns/roles'
import { detectItems } from '../../core/detect/items'
import { cellId, itemsFromTable, textItems } from '../../core/items/table'
import { Review, type Finding, type Warning } from '../../core/review/review'

export function itemsFor(rows: readonly (readonly string[])[], columns: readonly number[]) {
  const width = Math.max(...rows.map(row => row.length), ...columns.map(column => column + 1))
  const roles = Array.from({ length: width }, (_, column): ColumnRole => (columns.includes(column) ? 'scan' : 'keep'))
  return itemsFromTable({ columns: roles.map((_, column) => `c${column}`), rows }, roles).items
}

/** A review of the given rows, with the given columns checked. */
export function reviewFor(rows: readonly (readonly string[])[], columns: readonly number[]): Review {
  const items = itemsFor(rows, columns)
  return new Review(items, detectItems(textItems(items)))
}

/** The item id of a cell, as the table adapter makes it (sheet 0). */
export const at = (row: number, column: number) => cellId(row, column)

/** The row and column of a finding or warning, read from its item id. */
export function cellOf(found: Pick<Finding | Warning, 'item'>): { row: number, column: number } {
  const [, , row, column] = found.item.split(':')
  return { row: Number(row), column: Number(column) }
}
