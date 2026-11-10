// Long texts and the name model. The model reads at most 512 tokens at a time
// (about 300 to 400 words) and silently ignores the rest, so a long text is
// split into chunks that each fit: at paragraph breaks where possible, then at
// sentence ends, then between words. Each chunk starts with the last sentence
// of the one before, so a name at a boundary is seen whole in at least one of
// them; names found twice in that overlap are merged into one (mergeOverlapping).
// A text that fits is a single chunk, exactly as before.
import type { Detection } from './types.ts'

export type Range = { start: number, end: number }

// Ends of pieces worth keeping together: a paragraph break, a line break, a sentence end.
const BOUNDARY = /\n\s*\n|\n|[.!?…]+["'”’)\]]*\s+/g

/** The text cut into pieces at paragraph, line and sentence ends; together they cover the whole text. */
function pieces(text: string): Range[] {
  const found: Range[] = []
  let start = 0
  for (const match of text.matchAll(BOUNDARY)) {
    const end = match.index + match[0].length
    if (end > start) found.push({ start, end })
    start = end
  }
  if (start < text.length) found.push({ start, end: text.length })
  return found
}

/** A piece too long on its own, cut between words (or, for one endless word, anywhere) into parts that fit. */
function cutToFit(text: string, piece: Range, fits: (text: string) => boolean): Range[] {
  const parts: Range[] = []
  let start = piece.start
  while (start < piece.end) {
    let end = start
    for (const word of text.slice(start, piece.end).matchAll(/\S+\s*/g)) {
      const next = start + word.index + word[0].length
      if (end > start && !fits(text.slice(start, next))) break
      end = next
    }
    // A single word longer than the model can read: cut it where it still fits.
    while (end - start > 1 && !fits(text.slice(start, end))) end = start + Math.floor((end - start) / 2)
    parts.push({ start, end })
    start = end
  }
  return parts
}

/** Ranges of the text that each fit the model, in order, overlapping by one piece. */
export function chunkText(text: string, fits: (text: string) => boolean): Range[] {
  if (fits(text)) return [{ start: 0, end: text.length }]
  const all = pieces(text).flatMap(piece => (fits(text.slice(piece.start, piece.end)) ? [piece] : cutToFit(text, piece, fits)))
  const chunks: Range[] = []
  let first = 0
  while (first < all.length) {
    let last = first
    while (last + 1 < all.length && fits(text.slice(all[first]!.start, all[last + 1]!.end))) last++
    chunks.push({ start: all[first]!.start, end: all[last]!.end })
    if (last === all.length - 1) break
    // The next chunk starts with this chunk's last piece, unless that piece is all it held.
    first = last > first ? last : last + 1
  }
  return chunks
}

/**
 * Detections from overlapping chunks as one list: detections that overlap
 * (the same name found in two chunks) become one covering both, with the type
 * of the longer one, so no part of a name is left behind.
 */
export function mergeOverlapping(text: string, found: readonly Detection[]): Detection[] {
  const merged: Detection[] = []
  for (const detection of [...found].sort((a, b) => a.start - b.start || b.end - a.end)) {
    const last = merged.at(-1)
    if (!last || detection.start >= last.end) {
      merged.push({ ...detection })
      continue
    }
    if (detection.end - detection.start > last.end - last.start) last.type = detection.type
    last.end = Math.max(last.end, detection.end)
    last.value = text.slice(last.start, last.end)
  }
  return merged
}
