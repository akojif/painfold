import { describe, expect, it } from 'vitest'
import type { ColumnRole } from '../../core/columns/roles'
import { cleanedTable } from '../../core/export/csv'
import { detectItems } from '../../core/detect/items'
import { cellId, itemsFromTable, rebuildTable, rowId, sheetIndexOf, textItems } from '../../core/items/table'
import { Review } from '../../core/review/review'

// All values are invented.
const table = {
  columns: ['id', 'date', 'customer_email', 'message', 'channel', 'note'],
  rows: [
    ['1', '2026-10-01', 'vera.lind@example.com', 'Bitte an vera.lind@example.com schreiben.', 'email', 'Ruf 0664 1234567'],
    ['2', '2026-10-02', 'tom.reyes@example.org', '', ' chat ', ''],
    ['3', '', 'ana.kos@example.net', 'Export dauert zu lange.', '', 'ok'],
  ],
}
// id kept, date kept, email dropped, message checked, channel kept, note checked.
const roles: ColumnRole[] = ['keep', 'keep', 'drop', 'scan', 'keep', 'scan']

describe('itemsFromTable', () => {
  it('makes every checked cell an item, empty ones included, in reading order', () => {
    const { items } = itemsFromTable(table, roles)
    expect(items.map(item => [item.id, item.text])).toEqual([
      ['cell:0:0:3', 'Bitte an vera.lind@example.com schreiben.'],
      ['cell:0:0:5', 'Ruf 0664 1234567'],
      ['cell:0:1:3', ''],
      ['cell:0:1:5', ''],
      ['cell:0:2:3', 'Export dauert zu lange.'],
      ['cell:0:2:5', 'ok'],
    ])
    expect(items[0]).toMatchObject({ source: { kind: 'cell', sheet: 0, row: 0, column: 3 }, unit: 'row:0:0' })
  })

  it('makes every row a unit', () => {
    const { units } = itemsFromTable(table, roles)
    expect(units.map(unit => [unit.id, unit.source])).toEqual([
      ['row:0:0', { kind: 'row', sheet: 0, row: 0 }],
      ['row:0:1', { kind: 'row', sheet: 0, row: 1 }],
      ['row:0:2', { kind: 'row', sheet: 0, row: 2 }],
    ])
  })

  it('fills attributes only from columns kept as they are, without empty values', () => {
    const { units } = itemsFromTable(table, roles)
    expect(units.map(unit => unit.attributes)).toEqual([
      { id: '1', date: '2026-10-01', channel: 'email' },
      { id: '2', date: '2026-10-02', channel: 'chat' },
      { id: '3' },
    ])
  })

  it('never puts a dropped column in the attributes', () => {
    const { units } = itemsFromTable(table, roles)
    for (const unit of units) {
      expect(Object.keys(unit.attributes)).not.toContain('customer_email')
      expect(Object.values(unit.attributes).join(' ')).not.toContain('@example.')
    }
  })

  it('keeps checked columns as items, never as attributes', () => {
    const { items, units } = itemsFromTable(table, roles)
    for (const unit of units) {
      expect(Object.keys(unit.attributes)).not.toContain('message')
      expect(Object.keys(unit.attributes)).not.toContain('note')
    }
    // Checking a column moves it from the attributes to the items.
    const checkedChannel = itemsFromTable(table, ['keep', 'keep', 'drop', 'scan', 'scan', 'scan'])
    expect(checkedChannel.units[0]!.attributes).toEqual({ id: '1', date: '2026-10-01' })
    expect(checkedChannel.items.some(item => item.id === cellId(0, 4))).toBe(true)
    expect(items.some(item => item.id === cellId(0, 4))).toBe(false)
  })

  it('gives the same ids for the same file, whatever else is checked, kept or dropped', () => {
    const first = itemsFromTable(table, roles)
    expect(itemsFromTable(table, roles)).toEqual(first)
    const others = itemsFromTable(table, ['drop', 'drop', 'scan', 'scan', 'drop', 'drop'])
    const message = (set: typeof first) => set.items.filter(item => item.source.kind === 'cell' && item.source.column === 3).map(item => item.id)
    expect(message(others)).toEqual(message(first))
    expect(others.units.map(unit => unit.id)).toEqual(first.units.map(unit => unit.id))
  })

  it('uses the sheet\'s position in the ids, never its name, so two sheets never share an id', () => {
    const { items, units } = itemsFromTable({ ...table, sheetIndex: 2 }, roles)
    expect(items[0]).toMatchObject({ id: 'cell:2:0:3', source: { kind: 'cell', sheet: 2, row: 0, column: 3 }, unit: 'row:2:0' })
    expect(units[0]!.id).toBe(rowId(0, 2))
    // A sheet named after a customer never reaches an id or a location.
    const named = itemsFromTable({ ...table, sheetIndex: 1, sheetName: 'Kunde Huber' } as Parameters<typeof itemsFromTable>[0], roles)
    expect(JSON.stringify(named)).not.toContain('Huber')
  })
})

describe('sheetIndexOf', () => {
  it('gives the read sheet\'s position, and 0 for CSV', () => {
    expect(sheetIndexOf({ sheetNames: ['Übersicht', 'Kunde Huber'], sheetName: 'Kunde Huber' })).toBe(1)
    expect(sheetIndexOf({})).toBe(0)
  })
})

describe('rebuildTable', () => {
  it('gives back the table without dropped columns when nothing is cleaned', () => {
    expect(rebuildTable(table, roles, item => item.text)).toEqual({
      header: ['id', 'date', 'message', 'channel', 'note'],
      rows: table.rows.map(row => [row[0], row[1], row[3], row[4], row[5]]),
    })
  })

  it('builds the cleaned table from the review\'s cleaned items', () => {
    const { items } = itemsFromTable(table, roles)
    const review = new Review(items, detectItems(textItems(items)))
    const fromItems = rebuildTable(table, roles, item => review.cleanedItem(item.id))
    expect(fromItems).toEqual(cleanedTable(table, roles, review))
    expect(fromItems.rows[0]).toEqual(['1', '2026-10-01', 'Bitte an [EMAIL_1] schreiben.', 'email', 'Ruf [PHONE_1]'])
  })
})
