// The table adapter: a CSV or XLSX table as items and units, and the cleaned
// items put back into a table. With core/export/csv.ts, the only code after
// the column step that knows about rows and columns.
//
// - Every checked cell is an item, empty ones included, so a row in the review
//   shows exactly as before.
// - Every row is a unit. Its attributes are the non-empty values of the
//   columns kept as they are ("Keep as is"). Dropped columns never appear, and
//   checked columns are items, never attributes.
// - Ids come from the location: "cell:<sheet>:<row>:<column>" for an item and
//   "row:<sheet>:<row>" for a unit, all counted from 0: the sheet's position
//   in the workbook (0 for CSV), and row and column in the data, after the
//   header. Never the sheet's name, which can hold personal data, since ids
//   may later appear in quotes, links and exports.
import type { ColumnRole } from '../columns/roles.ts'
import type { ItemCounts, ItemDetections, TextItem } from '../detect/items.ts'
import type { CellDetections } from '../detect/table.ts'
import type { PiiType } from '../pii-types.ts'
import type { Item, ItemSet, Unit } from './types.ts'

/** sheetIndex: the sheet's position in the workbook, 0 for CSV. */
export type TableInput = { columns: readonly string[], rows: readonly (readonly string[])[], sheetIndex?: number }

/** The read sheet's position in an imported workbook; 0 for CSV, which has one. */
export function sheetIndexOf(table: { sheetNames?: readonly string[], sheetName?: string }): number {
  const index = table.sheetName === undefined ? -1 : (table.sheetNames ?? []).indexOf(table.sheetName)
  return Math.max(0, index)
}

export const cellId = (row: number, column: number, sheet = 0) => `cell:${sheet}:${row}:${column}`
export const rowId = (row: number, sheet = 0) => `row:${sheet}:${row}`

/** The checked cells as items and the rows as units with their kept values as attributes. */
export function itemsFromTable(table: TableInput, roles: readonly ColumnRole[]): ItemSet {
  const sheet = table.sheetIndex ?? 0
  const checked = table.columns.flatMap((_, column) => (roles[column] === 'scan' ? [column] : []))
  const kept = table.columns.flatMap((_, column) => (roles[column] === 'keep' ? [column] : []))
  const items: Item[] = []
  const units: Unit[] = []
  for (const [row, cells] of table.rows.entries()) {
    const unit = rowId(row, sheet)
    const attributes: Record<string, string> = {}
    for (const column of kept) {
      const value = cells[column]?.trim() ?? ''
      if (value) attributes[table.columns[column]!] = value
    }
    units.push({ id: unit, source: { kind: 'row', sheet, row }, attributes })
    for (const column of checked) {
      items.push({ id: cellId(row, column, sheet), text: cells[column] ?? '', source: { kind: 'cell', sheet, row, column }, unit })
    }
  }
  return { items, units }
}

/**
 * The table with every checked cell replaced by its item's cleaned text:
 * dropped columns left out, kept columns unchanged. `cleaned` is called once
 * per item.
 */
export function rebuildTable(table: TableInput, roles: readonly ColumnRole[], cleaned: (item: Item) => string): { header: string[], rows: string[][] } {
  const { items } = itemsFromTable(table, roles)
  const byCell = new Map(items.map(item => [item.id, cleaned(item)]))
  const sheet = table.sheetIndex ?? 0
  const shown = table.columns.flatMap((_, column) => (roles[column] === 'drop' ? [] : [column]))
  return {
    header: shown.map(column => table.columns[column]!),
    rows: table.rows.map((cells, row) => shown.map(column => byCell.get(cellId(row, column, sheet)) ?? cells[column] ?? '')),
  }
}

/** Items for the given columns, as if only they were checked: for the column step's survey. */
export function itemsForColumns(table: TableInput, columns: readonly number[]): Item[] {
  const roles: ColumnRole[] = table.columns.map((_, column) => (columns.includes(column) ? 'scan' : 'drop'))
  return itemsFromTable(table, roles).items
}

/** What the workers need of each item: its id, text and unit, not where it came from. */
export const textItems = (items: readonly Item[]): TextItem[] => items.map(({ id, text, unit }) => ({ id, text, unit }))

/** How much personal data each column holds, as counts per type. */
export type ColumnCounts = { column: number, counts: Partial<Record<PiiType, number>> }

/** Adds up the survey's counts per item by the item's column: only counts, never the values themselves. */
export function countsByColumn(items: readonly Item[], counts: readonly ItemCounts[]): ColumnCounts[] {
  const columnOf = new Map(items.map(item => [item.id, item.source.kind === 'cell' ? item.source.column : -1]))
  const byColumn = new Map<number, Partial<Record<PiiType, number>>>()
  for (const { id, counts: itemCounts } of counts) {
    const column = columnOf.get(id)
    if (column === undefined || column < 0) continue
    const total = byColumn.get(column) ?? {}
    for (const [type, n] of Object.entries(itemCounts) as [PiiType, number][]) total[type] = (total[type] ?? 0) + n
    byColumn.set(column, total)
  }
  return [...byColumn].map(([column, counts]) => ({ column, counts })).sort((a, b) => a.column - b.column)
}

/**
 * The workers' results as findings per cell, for the review, which still
 * works on rows and columns until it moves to items (#86, PR 3).
 */
export function toCellDetections(items: readonly Item[], results: readonly ItemDetections[]): CellDetections[] {
  const byId = new Map(items.map(item => [item.id, item]))
  return results.flatMap(({ id, detections }) => {
    const source = byId.get(id)?.source
    return source?.kind === 'cell' ? [{ row: source.row, column: source.column, detections }] : []
  })
}
