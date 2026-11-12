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
