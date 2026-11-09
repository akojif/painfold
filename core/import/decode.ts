import type { TextEncoding } from './types.ts'

/**
 * Decodes a text file's bytes. A byte order mark decides the encoding; without
 * one, UTF-8 is tried first and Windows-1252 is the fallback, because Excel on
 * Windows still saves German CSV files that way.
 */
export function decodeText(bytes: Uint8Array): { text: string, encoding: TextEncoding } {
  const encoding = detectEncoding(bytes)
  return { text: new TextDecoder(encoding).decode(bytes), encoding }
}

function detectEncoding(bytes: Uint8Array): TextEncoding {
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return 'utf-8'
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return 'utf-16le'
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return 'utf-16be'
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return 'utf-8'
  }
  catch {
    return 'windows-1252'
  }
}
