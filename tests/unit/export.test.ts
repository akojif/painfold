import { describe, expect, it } from 'vitest'
import { detectTable } from '../../core/detect/table'
import { cleanedFileName, cleanedTable, leakedValues, neutralizeFormula, removedByType, toCsv } from '../../core/export/csv'
import { importFile } from '../../core/import'
import { Review } from '../../core/review/review'

describe('neutralizeFormula', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+cmd|" /C calc"!A0', '\'+cmd|" /C calc"!A0'],
    ['-2+3', "'-2+3"],
    ['@SUM(A1:A2)', "'@SUM(A1:A2)"],
    ['\t=1+1', "'\t=1+1"],
    ['\r=1+1', "'\r=1+1"],
    ['  =HYPERLINK("https://example.com")', '\'  =HYPERLINK("https://example.com")'],
    ['+43 664 1234567', "'+43 664 1234567"],
  ])('protects %j', (cell, expected) => {
    expect(neutralizeFormula(cell)).toBe(expected)
  })

  it.each(['Hello', '12,50', '-12,50', '-5', '+7', '1.299,00', 'a=b', 'E-Mail', ''])('leaves %j alone', (cell) => {
    expect(neutralizeFormula(cell)).toBe(cell)
  })
})

const CSV = [
  'id,name,message,note',
  '1,Anna Feldmoser,"Mail anna@example.com, IP 192.0.2.7",=1+1',
  '2,James Dunmore,"Again anna@example.com ""soon""","-12,50"',
  '3,Sophie,"No findings, just text",@SUM(A1)',
].join('\n')

async function setUp() {
  const table = await importFile({ name: 'tickets.csv', bytes: new TextEncoder().encode(CSV) })
  const roles = ['keep', 'drop', 'scan', 'keep'] as const
  const review = new Review(table.rows, [2], detectTable(table.rows, [2]))
  return { table, roles: [...roles], review }
}

describe('cleanedTable and toCsv', () => {
  it('drops columns, replaces findings in checked columns and keeps the rest', async () => {
    const { table, roles, review } = await setUp()
    const file = cleanedTable(table, roles, review)
    expect(file.header).toEqual(['id', 'message', 'note'])
    expect(file.rows).toEqual([
      ['1', 'Mail [EMAIL_1], IP [IP_1]', '=1+1'],
      ['2', 'Again [EMAIL_1] "soon"', '-12,50'],
      ['3', 'No findings, just text', '@SUM(A1)'],
    ])
  })

  it('writes CSV with a byte order mark, CRLF, quoting, formula protection and the note last', async () => {
    const { table, roles, review } = await setUp()
    const csv = toCsv(cleanedTable(table, roles, review), { note: 'Note from Painfold: check it.' })
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('id,message,note')
    expect(lines[1]).toBe('1,"Mail [EMAIL_1], IP [IP_1]",\'=1+1')
    expect(lines[2]).toBe('2,"Again [EMAIL_1] ""soon""","-12,50"')
    expect(lines[3]).toBe("3,\"No findings, just text\",'@SUM(A1)")
    expect(lines.slice(4)).toEqual(['', 'Note from Painfold: check it.', ''])
  })

  it('uses the delimiter it is given', async () => {
    const { table, roles, review } = await setUp()
    expect(toCsv(cleanedTable(table, roles, review), { delimiter: ';' }).split('\r\n')[1]).toBe("1;Mail [EMAIL_1], IP [IP_1];'=1+1")
  })

  it('keeps values the reader decided to keep', async () => {
    const { table, roles, review } = await setUp()
    review.decide(review.findings[1]!.key, 'keep')
    expect(cleanedTable(table, roles, review).rows[0]![1]).toBe('Mail [EMAIL_1], IP 192.0.2.7')
  })

  it('counts what is removed, by type', async () => {
    const { review } = await setUp()
    expect([...removedByType(review)]).toEqual([['EMAIL', 2], ['IP', 1]])
  })
})

describe('leakedValues (the check behind the "nothing removed reaches the download" tests)', () => {
  it('finds nothing in a cleaned export', async () => {
    const { table, roles, review } = await setUp()
    expect(leakedValues(toCsv(cleanedTable(table, roles, review)), review)).toEqual([])
  })

  it('catches every value when redaction is switched off', async () => {
    const { table, roles, review } = await setUp()
    const unredacted = toCsv({ header: table.columns, rows: table.rows.map(cells => cells.filter((_, index) => roles[index] !== 'drop')) })
    expect(leakedValues(unredacted, review)).toEqual(['anna@example.com', '192.0.2.7'])
  })
})

describe('cleanedFileName', () => {
  it.each([['tickets.csv', 'tickets_cleaned.csv'], ['Rückmeldungen.xlsx', 'Rückmeldungen_cleaned.csv'], ['notes', 'notes_cleaned.csv'], ['.csv', 'feedback_cleaned.csv']])('%s becomes %s', (input, expected) => {
    expect(cleanedFileName(input)).toBe(expected)
  })
})
