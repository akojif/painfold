import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { utils, write } from 'xlsx'
import { importFile, ImportError, MAX_FILE_BYTES, MAX_ROWS, type ImportErrorCode } from '../../core/import'

const bytes = (text: string) => new TextEncoder().encode(text)
const csv = (text: string, name = 'feedback.csv') => importFile({ name, bytes: bytes(text) })

function workbook(sheets: Record<string, unknown[][]>): Uint8Array {
  const book = utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) utils.book_append_sheet(book, utils.aoa_to_sheet(rows, { cellDates: true }), name)
  return write(book, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
}

async function expectImportError(promise: Promise<unknown>, code: ImportErrorCode) {
  const error = await promise.then(() => undefined, (caught: unknown) => caught)
  expect(error).toBeInstanceOf(ImportError)
  expect((error as ImportError).code).toBe(code)
}

describe('CSV import', () => {
  it('reads the sample file', async () => {
    const table = await importFile({ name: 'support-tickets.csv', bytes: readFileSync(new URL('../../data/sample/support-tickets.csv', import.meta.url)) })
    expect(table).toMatchObject({ format: 'csv', encoding: 'utf-8', delimiter: ',', raggedRows: 0 })
    expect(table.columns).toEqual(['id', 'created_at', 'channel', 'rating', 'plan', 'country', 'customer_name', 'customer_email', 'message'])
    expect(table.rows).toHaveLength(200)
    expect(table.rows.some(row => row[8]!.includes('\n'))).toBe(true)
  })

  it.each([
    [',', 'id,text\n1,Hallo\n2,Hello'],
    [';', 'id;betrag;text\n1;12,50;Hallo\n2;3,99;Servus'],
    ['\t', 'id\ttext\n1\tHallo, Welt\n2\tHello'],
    ['|', 'id|text\n1|Hallo\n2|Hello'],
  ])('detects the %j delimiter', async (delimiter, text) => {
    const table = await csv(text)
    expect(table.delimiter).toBe(delimiter)
    expect(table.rows[0]![0]).toBe('1')
  })

  it('reads semicolon files with decimal commas, as German Excel saves them', async () => {
    const table = await csv('id;betrag;text\n1;12,50;Hallo\n2;3,99;Servus')
    expect(table.columns).toEqual(['id', 'betrag', 'text'])
    expect(table.rows[0]).toEqual(['1', '12,50', 'Hallo'])
  })

  it('strips a UTF-8 byte order mark', async () => {
    const table = await importFile({ name: 'a.csv', bytes: new Uint8Array([0xEF, 0xBB, 0xBF, ...bytes('text\nÄrger')]) })
    expect(table.encoding).toBe('utf-8')
    expect(table.columns).toEqual(['text'])
    expect(table.rows[0]).toEqual(['Ärger'])
  })

  it('falls back to Windows-1252 for files that are not UTF-8', async () => {
    // "Straße;Größe\nÄrger;Öl" in Windows-1252
    const latin = new Uint8Array([0x53, 0x74, 0x72, 0x61, 0xDF, 0x65, 0x3B, 0x47, 0x72, 0xF6, 0xDF, 0x65, 0x0A, 0xC4, 0x72, 0x67, 0x65, 0x72, 0x3B, 0xD6, 0x6C])
    const table = await importFile({ name: 'export.csv', bytes: latin })
    expect(table.encoding).toBe('windows-1252')
    expect(table.columns).toEqual(['Straße', 'Größe'])
    expect(table.rows[0]).toEqual(['Ärger', 'Öl'])
  })

  it('reads UTF-16 with a byte order mark, as Excel saves "Unicode text"', async () => {
    const text = 'text\tland\nÄrger\tAT'
    const utf16 = new Uint8Array(2 + text.length * 2)
    utf16.set([0xFF, 0xFE])
    for (let i = 0; i < text.length; i++) new DataView(utf16.buffer).setUint16(2 + i * 2, text.charCodeAt(i), true)
    const table = await importFile({ name: 'unicode.txt', bytes: utf16 })
    expect(table.encoding).toBe('utf-16le')
    expect(table.rows[0]).toEqual(['Ärger', 'AT'])
  })

  it('keeps quoted delimiters, quotes and line breaks inside cells', async () => {
    const table = await csv('id,text\n1,"Hallo, ""Welt""\nzweite Zeile"\n')
    expect(table.rows).toEqual([['1', 'Hallo, "Welt"\nzweite Zeile']])
  })

  it('pads short rows, adds columns for long ones, and counts both', async () => {
    const table = await csv('a,b\n1\n2,3,4\n5,6')
    expect(table.columns).toEqual(['a', 'b', 'Column 3'])
    expect(table.rows).toEqual([['1', '', ''], ['2', '3', '4'], ['5', '6', '']])
    expect(table.raggedRows).toBe(2)
  })

  it('names blank headers and makes repeated headers unique', async () => {
    const table = await csv('text,,Text,text\na,b,c,d')
    expect(table.columns).toEqual(['text', 'Column 2', 'Text (2)', 'text (3)'])
  })

  it('skips blank lines', async () => {
    const table = await csv('\n\ntext\n\nHallo\n  \nHello\n')
    expect(table.rows).toEqual([['Hallo'], ['Hello']])
  })
})

describe('XLSX import', () => {
  const file = workbook({
    Tickets: [
      ['id', 'created_at', 'rating', 'customer_no', 'message'],
      [1, new Date(Date.UTC(2026, 2, 4)), 4, '00123', 'Der Export ist langsam.'],
      [2, null, null, '00456', 'Please add reminders.'],
    ],
    Notes: [['note'], ['Second sheet']],
  })

  it('reads the first sheet as text and lists all sheets', async () => {
    const table = await importFile({ name: 'tickets.xlsx', bytes: file })
    expect(table).toMatchObject({ format: 'xlsx', sheetNames: ['Tickets', 'Notes'], sheetName: 'Tickets' })
    expect(table.columns).toEqual(['id', 'created_at', 'rating', 'customer_no', 'message'])
    expect(table.rows[0]![3]).toBe('00123') // numbers stored as text keep their leading zeros
    expect(table.rows[0]![1]).not.toBe('') // dates come through as Excel displays them
    expect(table.rows[1]).toEqual(['2', '', '', '00456', 'Please add reminders.'])
  })

  it('reads a named sheet', async () => {
    const table = await importFile({ name: 'tickets.xlsx', bytes: file }, { sheetName: 'Notes' })
    expect(table.rows).toEqual([['Second sheet']])
  })

  it('reads the sample workbook with the same content as the sample CSV', async () => {
    const read = (name: string) => importFile({ name, bytes: readFileSync(new URL(`../../data/sample/${name}`, import.meta.url)) })
    const [fromCsv, fromXlsx] = await Promise.all([read('support-tickets.csv'), read('support-tickets.xlsx')])
    expect(fromXlsx.columns).toEqual(fromCsv.columns)
    expect(fromXlsx.rows).toEqual(fromCsv.rows)
  })

  it('identifies an XLSX file by its content even with a .csv name', async () => {
    const table = await importFile({ name: 'renamed.csv', bytes: file })
    expect(table.format).toBe('xlsx')
  })
})

describe('import errors', () => {
  it('rejects empty files and files with only blank lines', async () => {
    await expectImportError(csv(''), 'empty-file')
    await expectImportError(csv('\n \n'), 'empty-file')
  })

  it('rejects a header without data rows', async () => {
    await expectImportError(csv('id,text\n'), 'no-rows')
  })

  it('rejects files above the row limit', async () => {
    await expectImportError(csv(`text\n${'x\n'.repeat(MAX_ROWS + 1)}`), 'too-many-rows')
  })

  it('accepts exactly the row limit', async () => {
    expect((await csv(`text\n${'x\n'.repeat(MAX_ROWS)}`)).rows).toHaveLength(MAX_ROWS)
  })

  it('rejects files above the size limit before reading them', async () => {
    await expectImportError(importFile({ name: 'big.csv', bytes: new Uint8Array(MAX_FILE_BYTES + 1) }), 'file-too-large')
  })

  it('explains that old .xls files need saving as XLSX or CSV', async () => {
    await expectImportError(importFile({ name: 'old.xls', bytes: bytes('x') }), 'legacy-excel')
    await expectImportError(importFile({ name: 'old.xlsx', bytes: new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0, 0]) }), 'legacy-excel')
  })

  it('rejects other formats', async () => {
    await expectImportError(importFile({ name: 'notes.pdf', bytes: bytes('%PDF-1.7') }), 'unsupported-format')
    await expectImportError(importFile({ name: 'noextension', bytes: bytes('a,b') }), 'unsupported-format')
  })

  it('reports a damaged XLSX file as unreadable', async () => {
    await expectImportError(importFile({ name: 'broken.xlsx', bytes: new Uint8Array([0x50, 0x4B, 0x03, 0x04, 1, 2, 3, 4]) }), 'unreadable')
  })
})
