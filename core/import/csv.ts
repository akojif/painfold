import Papa from 'papaparse'
import { decodeText } from './decode.ts'
import { normalizeTable } from './table.ts'
import type { ImportedTable } from './types.ts'

const DELIMITERS = [',', ';', '\t', '|']

export function readCsv(fileName: string, bytes: Uint8Array): ImportedTable {
  const { text, encoding } = decodeText(bytes)
  const result = Papa.parse<string[]>(text, { delimitersToGuess: DELIMITERS, skipEmptyLines: 'greedy' })
  return {
    fileName,
    format: 'csv',
    encoding,
    delimiter: result.meta.delimiter,
    ...normalizeTable(result.data),
  }
}
