import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { suggestRoles, type ColumnRole } from '../../core/columns/roles'
import { detectItems } from '../../core/detect/items'
import { detectTable } from '../../core/detect/table'
import { cleanedTable, toCsv } from '../../core/export/csv'
import { readCsv } from '../../core/import/csv'
import { itemsFromTable, textItems, toCellDetections } from '../../core/items/table'
import { Review } from '../../core/review/review'

// Detection on feedback items must find exactly what detection on rows and
// columns found, so the review, the cleaned file and the report cannot change
// (#86). Checked on the bundled sample file and on invented worst cases.
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

function bothWays(table: { columns: string[], rows: string[][] }, roles: ColumnRole[]) {
  const scan = roles.flatMap((role, column) => (role === 'scan' ? [column] : []))
  const byCell = detectTable(table.rows, scan)
  const { items } = itemsFromTable(table, roles)
  const byItem = toCellDetections(items, detectItems(textItems(items)))
  return { byCell, byItem }
}

describe('detection on items', () => {
  for (const [name, table, roles] of [
    ['the sample file, with its suggested columns', sample, suggestRoles(sample).map(suggestion => suggestion.role)],
    ['the sample file, with every column checked', sample, sample.columns.map((): ColumnRole => 'scan')],
    ['worst cases, with two checked columns and a dropped one', worst, ['keep', 'scan', 'scan', 'drop'] as ColumnRole[]],
  ] as const) {
    it(`finds the same as detection on rows and columns: ${name}`, () => {
      const { byCell, byItem } = bothWays(table, [...roles])
      expect(byCell.length).toBeGreaterThan(0)
      expect(byItem).toEqual(byCell)
    })

    it(`cleans the file to the same bytes: ${name}`, () => {
      const scan = roles.flatMap((role, column) => (role === 'scan' ? [column] : []))
      const { byCell, byItem } = bothWays(table, [...roles])
      const clean = (cells: typeof byCell) => toCsv(cleanedTable(table, roles, new Review(table.rows, scan, cells)))
      expect(clean(byItem)).toBe(clean(byCell))
    })
  }
})
