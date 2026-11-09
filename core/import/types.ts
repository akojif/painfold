export type FileFormat = 'csv' | 'xlsx'
export type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252'

/** A file read into memory: one header row turned into column names, then data rows. */
export type ImportedTable = {
  fileName: string
  format: FileFormat
  columns: string[]
  rows: string[][]
  /** CSV only. */
  encoding?: TextEncoding
  delimiter?: string
  /** XLSX only: every sheet in the workbook and the one that was read. */
  sheetNames?: string[]
  sheetName?: string
  /** Rows that had more or fewer cells than the header, padded or extended. */
  raggedRows: number
}

export type ImportErrorCode
  = | 'empty-file'
    | 'file-too-large'
    | 'no-rows'
    | 'too-many-rows'
    | 'unsupported-format'
    | 'legacy-excel'
    | 'unreadable'

/** Import failures carry a code so the interface can explain them in the user's language. */
export class ImportError extends Error {
  readonly code: ImportErrorCode

  constructor(code: ImportErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'ImportError'
    this.code = code
  }
}

export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const MAX_ROWS = 50_000
