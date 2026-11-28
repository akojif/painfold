import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { suggestRoles, type ColumnRole } from '../../core/columns/roles'
import { detectItems } from '../../core/detect/items'
import { detect } from '../../core/detect/index'
import type { Detection } from '../../core/detect/types'
import { readCsv } from '../../core/import/csv'
import { itemsFromTable, textItems } from '../../core/items/table'

// Detection on feedback items must find exactly what detection on every
// checked cell finds (#86). The reference below is the plain loop over rows
// and columns that the app used before items. Checked on the bundled sample
// file and on invented worst cases.
const sample = readCsv('support-tickets.csv', new Uint8Array(readFileSync(new URL('../../data/sample/support-tickets.csv', import.meta.url))))

const worst = {
  columns: ['ticket_id', 'message', 'note', 'customer_email'],
  rows: [
    ['ZD-1', 'Bitte an bartholomew.fitzgerald@example.com schicken, nicht an mich.', 'Rückruf +43 660 234 2972', 'aleksandra.w@example.com'],
    ['ZD-2', 'IBAN AT61 1904 3002 3457 3201, Karte 5555 5555 5555 4444, UID ATU13585627, IP 192.0.2.7\nZweite Zeile: geboren am 12.03.1987, Lindengasse 5/2/7, 1070 Wien', '', ''],
    ['ZD-3', '', 'SV-Nummer 1237 010180 bitte ändern', ''],
    ['ZD-4', 'x', 'Link https://example.com/tickets/2026/09?utm_source=newsletter', 'jo@example.com'],
    ['ZD-5', '', '', ''],
  ],
}

/** The reference: every checked cell, row by row, as the app did before items. */
function byCell(table: { rows: string[][] }, roles: readonly ColumnRole[]): Array<{ row: number, column: number, detections: Detection[] }> {
  const scan = roles.flatMap((role, column) => (role === 'scan' ? [column] : []))
  return table.rows.flatMap((cells, row) => scan.flatMap((column) => {
    const detections = detect(cells[column] ?? '')
    return detections.length > 0 ? [{ row, column, detections }] : []
  }))
}

function byItem(table: { columns: string[], rows: string[][] }, roles: readonly ColumnRole[]) {
  const { items } = itemsFromTable(table, roles)
  const cell = new Map(items.map(item => [item.id, item.source]))
  return detectItems(textItems(items)).map(({ id, detections }) => {
    const source = cell.get(id) as { row: number, column: number }
    return { row: source.row, column: source.column, detections }
  })
}

describe('detection on items', () => {
  for (const [name, table, roles] of [
    ['the sample file, with its suggested columns', sample, suggestRoles(sample).map(suggestion => suggestion.role)],
    ['the sample file, with every column checked', sample, sample.columns.map((): ColumnRole => 'scan')],
    ['worst cases, with two checked columns and a dropped one', worst, ['keep', 'scan', 'scan', 'drop'] as ColumnRole[]],
  ] as const) {
    it(`finds the same as detection on every checked cell: ${name}`, () => {
      const reference = byCell(table, roles)
      expect(reference.length).toBeGreaterThan(0)
      expect(byItem(table, roles)).toEqual(reference)
    })
  }
})
