import { readCsv } from './csv.ts'
import { identify, type FileFormatInfo } from './formats.ts'
import { readXlsx } from './xlsx.ts'
import { ImportError, MAX_FILE_BYTES, type ImportedTable } from './types.ts'

export * from './types.ts'
export { FORMATS, identify, looksLikeTable, SUPPORTED_EXTENSIONS, type FileFormatInfo, type FormatId, type FormatKind } from './formats.ts'

/**
 * What opening a file gives: a table to clean, or a document, a format that is
 * on the roadmap but not read yet (transcripts, DOCX, PDF and the like).
 */
export type OpenedFile
  = | { kind: 'table', table: ImportedTable }
    | { kind: 'document', format: FileFormatInfo }

/**
 * Opens a file entirely in memory. identify() decides the format (by content
 * where it can, by extension otherwise); tables are read, documents are only
 * recognised for now. Throws an ImportError for files Painfold cannot use.
 */
export async function openFile(file: { name: string, bytes: Uint8Array }, options: { sheetName?: string } = {}): Promise<OpenedFile> {
  const { name, bytes } = file
  if (bytes.length === 0) throw new ImportError('empty-file')
  if (bytes.length > MAX_FILE_BYTES) throw new ImportError('file-too-large', String(bytes.length))

  const format = identify(file)
  if (!format) throw new ImportError('unsupported-format', name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1])
  if (format.status === 'legacy') throw new ImportError('legacy-excel')
  if (format.kind === 'document') return { kind: 'document', format }
  return { kind: 'table', table: format.id === 'xlsx' ? await readXlsx(name, bytes, options.sheetName) : readCsv(name, bytes) }
}

/** Opens a file that must be a table; a document is reported as unsupported for now. */
export async function importFile(file: { name: string, bytes: Uint8Array }, options: { sheetName?: string } = {}): Promise<ImportedTable> {
  const opened = await openFile(file, options)
  if (opened.kind === 'document') throw new ImportError('unsupported-format', opened.format.id)
  return opened.table
}
