import { readCsv } from './csv.ts'
import { readXlsx } from './xlsx.ts'
import { ImportError, MAX_FILE_BYTES, type ImportedTable } from './types.ts'

export * from './types.ts'

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((byte, i) => bytes[i] === byte)
const ZIP = [0x50, 0x4B, 0x03, 0x04]
const OLE = [0xD0, 0xCF, 0x11, 0xE0] // pre-2007 .xls and other Office binary files

/**
 * Reads a CSV or XLSX file entirely in memory. The file's content decides the
 * format where it can (an XLSX file is a ZIP archive); the extension decides
 * the rest.
 */
export async function importFile(file: { name: string, bytes: Uint8Array }, options: { sheetName?: string } = {}): Promise<ImportedTable> {
  const { name, bytes } = file
  if (bytes.length === 0) throw new ImportError('empty-file')
  if (bytes.length > MAX_FILE_BYTES) throw new ImportError('file-too-large', String(bytes.length))

  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (startsWith(bytes, ZIP)) return readXlsx(name, bytes, options.sheetName)
  if (startsWith(bytes, OLE) || extension === 'xls') throw new ImportError('legacy-excel')
  if (extension === 'csv' || extension === 'tsv' || extension === 'txt') return readCsv(name, bytes)
  throw new ImportError('unsupported-format', extension)
}
