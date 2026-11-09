import { normalizeTable } from './table.ts'
import { ImportError, MAX_ROWS, type ImportedTable } from './types.ts'

/**
 * Reads one sheet of an XLSX workbook (the first, unless one is named).
 * SheetJS is loaded only when an XLSX file is opened, to keep it out of the
 * initial page load. Cells are read as the text Excel displays, and formulas,
 * styles and HTML are skipped.
 */
export async function readXlsx(fileName: string, bytes: Uint8Array, sheetName?: string): Promise<ImportedTable> {
  const { read, utils } = await import('xlsx')

  let workbook: ReturnType<typeof read>
  try {
    workbook = read(bytes, {
      type: 'array',
      dense: true,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      // One header row, the row limit, and one more to notice a file that is too long.
      sheetRows: MAX_ROWS + 2,
    })
  }
  catch (error) {
    throw new ImportError('unreadable', error instanceof Error ? error.message : undefined)
  }

  const sheetNames = workbook.SheetNames
  const chosen = sheetName ?? sheetNames[0]
  const sheet = chosen === undefined ? undefined : workbook.Sheets[chosen]
  if (!sheet) throw new ImportError('empty-file')

  const raw = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false })
  return {
    fileName,
    format: 'xlsx',
    sheetNames,
    sheetName: chosen,
    ...normalizeTable(raw.map(row => row.map(cell => String(cell ?? '')))),
  }
}
