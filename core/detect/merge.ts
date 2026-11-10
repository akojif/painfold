// How the name model's findings join findings that are already there (the
// rules' findings, or text marked in the review). Findings may not overlap, so
// the part of a name or place that another finding already covers is cut off,
// and what is left is kept: "Bristol BS" next to the postcode "BS1 4DJ" stays
// "Bristol", instead of leaving Bristol in the cleaned file.
import type { Detection } from './types.ts'

type Range = { start: number, end: number }

const EDGE = /[\s\p{P}]/u

/** The parts of a detection outside the given ranges, trimmed of spaces and punctuation, that still hold a letter. */
export function outside(text: string, detection: Detection, taken: readonly Range[]): Detection[] {
  let pieces: Range[] = [{ start: detection.start, end: detection.end }]
  for (const range of taken) {
    pieces = pieces.flatMap(piece => (range.end <= piece.start || range.start >= piece.end)
      ? [piece]
      : [{ start: piece.start, end: range.start }, { start: range.end, end: piece.end }].filter(part => part.end > part.start))
  }
  return pieces.flatMap((piece) => {
    let { start, end } = piece
    while (start < end && EDGE.test(text[start]!)) start++
    while (end > start && EDGE.test(text[end - 1]!)) end--
    const value = text.slice(start, end)
    return /\p{L}/u.test(value) ? [{ ...detection, start, end, value }] : []
  })
}

/** Rule findings first, then the name model's findings outside them. */
export function combined(text: string, rules: readonly Detection[], names: readonly Detection[]): Detection[] {
  return [...rules, ...names.flatMap(name => outside(text, name, rules))]
}
