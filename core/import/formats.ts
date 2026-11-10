// Every kind of file Painfold knows about, and how to tell which one a file is.
// Choosing a file and dropping one both go through identify(), so they always
// agree. A format is a table (opened today) or a document (planned: interview
// transcripts and documents, ROADMAP Stage 5). Adding a format later means
// adding an entry here and a reader for it, not changing how files are opened.
import { decodeText } from './decode.ts'

export type FormatKind = 'table' | 'document'
export type FormatId = 'csv' | 'xlsx' | 'xls' | 'docx' | 'doc' | 'odt' | 'rtf' | 'pdf' | 'text' | 'markdown' | 'transcript'

export type FileFormatInfo = {
  id: FormatId
  kind: FormatKind
  /** Supported: Painfold reads it now. Planned: on the roadmap, explained instead of read. Legacy: an old format to save again. */
  status: 'supported' | 'planned' | 'legacy'
  extensions: readonly string[]
}

export const FORMATS: readonly FileFormatInfo[] = [
  { id: 'csv', kind: 'table', status: 'supported', extensions: ['csv', 'tsv'] },
  { id: 'xlsx', kind: 'table', status: 'supported', extensions: ['xlsx'] },
  { id: 'xls', kind: 'table', status: 'legacy', extensions: ['xls'] },
  { id: 'docx', kind: 'document', status: 'planned', extensions: ['docx'] },
  { id: 'doc', kind: 'document', status: 'planned', extensions: ['doc'] },
  { id: 'odt', kind: 'document', status: 'planned', extensions: ['odt'] },
  { id: 'rtf', kind: 'document', status: 'planned', extensions: ['rtf'] },
  { id: 'pdf', kind: 'document', status: 'planned', extensions: ['pdf'] },
  { id: 'markdown', kind: 'document', status: 'planned', extensions: ['md', 'markdown'] },
  { id: 'transcript', kind: 'document', status: 'planned', extensions: ['vtt', 'srt'] },
  // Plain text is a document, unless it reads as a table (see identify).
  { id: 'text', kind: 'document', status: 'planned', extensions: ['txt'] },
]

const byId = (id: FormatId) => FORMATS.find(format => format.id === id)!

const startsWith = (bytes: Uint8Array, signature: readonly number[]) => signature.every((byte, i) => bytes[i] === byte)
const ZIP = [0x50, 0x4B, 0x03, 0x04]
const OLE = [0xD0, 0xCF, 0x11, 0xE0] // pre-2007 Office binary files (.xls, .doc)
const PDF = [0x25, 0x50, 0x44, 0x46] // %PDF

/**
 * What an Office ZIP holds, from the file names inside it. Every ZIP lists its
 * files in a directory at the end (and each entry starts with its name), so the
 * names can be found without unpacking: xl/ is a workbook, word/ a document,
 * and an OpenDocument file names its type in a "mimetype" entry.
 */
function zipContents(bytes: Uint8Array): FormatId | undefined {
  const ascii = (from: number, to: number) => new TextDecoder('latin1').decode(bytes.subarray(Math.max(0, from), Math.min(bytes.length, to)))
  const names = `${ascii(0, 4096)}${ascii(bytes.length - 65_536, bytes.length)}`
  if (names.includes('xl/workbook')) return 'xlsx'
  if (names.includes('word/document')) return 'docx'
  if (names.includes('opendocument.text')) return 'odt'
  return undefined
}

const DELIMITERS = ['\t', ';', ',', '|']

/**
 * Whether plain text reads as a table: its first lines (at least two) all
 * have the same number of one separator, at least once. Exported feedback in a
 * .txt file does; a transcript or a note does not.
 */
export function looksLikeTable(text: string): boolean {
  const lines = text.split(/\r?\n/).filter(line => line.trim()).slice(0, 10)
  if (lines.length < 2) return false
  return DELIMITERS.some((delimiter) => {
    const counts = lines.map(line => line.split(delimiter).length - 1)
    return counts[0]! > 0 && counts.every(count => count === counts[0])
  })
}

/**
 * Which format a file is: by its content where that is certain (ZIP, PDF and
 * old Office signatures), otherwise by its extension. Unknown files give
 * undefined.
 */
export function identify(file: { name: string, bytes: Uint8Array }): FileFormatInfo | undefined {
  const { name, bytes } = file
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
  if (startsWith(bytes, ZIP)) {
    const inside = zipContents(bytes)
    if (inside) return byId(inside)
  }
  if (startsWith(bytes, PDF)) return byId('pdf')
  if (startsWith(bytes, OLE)) return byId(extension === 'doc' ? 'doc' : 'xls')
  const known = FORMATS.find(format => format.extensions.includes(extension))
  if (known?.id === 'text') return looksLikeTable(decodeText(bytes).text) ? byId('csv') : known
  return known
}

/** The extensions of the formats Painfold reads today, for the file picker and messages. */
export const SUPPORTED_EXTENSIONS = FORMATS.filter(format => format.status === 'supported').flatMap(format => format.extensions)
