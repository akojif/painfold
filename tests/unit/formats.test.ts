import { describe, expect, it } from 'vitest'
import { utils, write } from 'xlsx'
import { identify, ImportError, looksLikeTable, openFile } from '../../core/import'

const text = (value: string) => new TextEncoder().encode(value)
// A ZIP as Office writes one: the local header signature, then entry names (and, at the end, the directory listing them).
const zipWith = (...names: string[]) => new Uint8Array([0x50, 0x4B, 0x03, 0x04, ...text(`....${names.join('....')}....`)])
const xlsx = () => {
  const book = utils.book_new()
  utils.book_append_sheet(book, utils.aoa_to_sheet([['message'], ['Danke!']]), 'Feedback')
  return write(book, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
}
const id = (name: string, bytes: Uint8Array) => identify({ name, bytes })?.id

describe('identify', () => {
  it('tells a workbook from a document inside the ZIP, whatever the file is called', () => {
    expect(id('tickets.xlsx', xlsx())).toBe('xlsx')
    expect(id('renamed.zip', xlsx())).toBe('xlsx')
    expect(id('interview.docx', zipWith('[Content_Types].xml', 'word/document.xml'))).toBe('docx')
    expect(id('notes.xlsx', zipWith('[Content_Types].xml', 'word/document.xml'))).toBe('docx')
    expect(id('notes.odt', zipWith('mimetypeapplication/vnd.oasis.opendocument.text'))).toBe('odt')
  })

  it('recognises PDF and old Office files by their content', () => {
    expect(id('report', text('%PDF-1.7 ...'))).toBe('pdf')
    const ole = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
    expect(id('old.xls', ole)).toBe('xls')
    expect(id('old.doc', ole)).toBe('doc')
  })

  it('opens a .txt as a table only when it reads like one', () => {
    expect(id('export.txt', text('id;message\n1;Danke\n2;Bitte'))).toBe('csv')
    expect(id('export.txt', text('id\tmessage\n1\tDanke\n2\tBitte'))).toBe('csv')
    expect(id('interview.txt', text('Interviewer: Wie war es?\nAnna: Gut, danke. Aber langsam.'))).toBe('text')
    expect(id('note.txt', text('Nur eine Zeile, mit Komma.'))).toBe('text')
  })

  it('knows transcripts and Markdown as documents, and nothing else', () => {
    expect(identify({ name: 'call.vtt', bytes: text('WEBVTT\n\n00:00.000 --> 00:02.000\nHallo') })).toMatchObject({ id: 'transcript', kind: 'document', status: 'planned' })
    expect(id('call.srt', text('1\n00:00:00,000 --> 00:00:02,000\nHallo'))).toBe('transcript')
    expect(id('notes.md', text('# Notizen'))).toBe('markdown')
    expect(id('photo.png', new Uint8Array([0x89, 0x50, 0x4E, 0x47]))).toBeUndefined()
  })
})

describe('looksLikeTable', () => {
  it('needs at least two lines with the same number of one separator', () => {
    expect(looksLikeTable('a,b\n1,2\n3,4')).toBe(true)
    expect(looksLikeTable('a,b\n1,2,3')).toBe(false)
    expect(looksLikeTable('a,b')).toBe(false)
  })
})

describe('openFile', () => {
  it('reads tables and only recognises documents', async () => {
    expect(await openFile({ name: 'tickets.csv', bytes: text('message\nDanke') })).toMatchObject({ kind: 'table', table: { format: 'csv', rows: [['Danke']] } })
    expect(await openFile({ name: 'interview.docx', bytes: zipWith('word/document.xml') })).toMatchObject({ kind: 'document', format: { id: 'docx' } })
  })

  it('explains old Excel files and unknown files with their own errors', async () => {
    await expect(openFile({ name: 'old.xls', bytes: new Uint8Array([0xD0, 0xCF, 0x11, 0xE0]) })).rejects.toMatchObject({ code: 'legacy-excel' })
    await expect(openFile({ name: 'photo.png', bytes: new Uint8Array([0x89, 0x50, 0x4E, 0x47]) })).rejects.toBeInstanceOf(ImportError)
    await expect(openFile({ name: 'photo.png', bytes: new Uint8Array([0x89, 0x50, 0x4E, 0x47]) })).rejects.toMatchObject({ code: 'unsupported-format' })
  })
})
