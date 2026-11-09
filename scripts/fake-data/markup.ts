// Test texts mark personal data inline as [[TYPE:value]]. parseMarkup() turns
// that into plain text plus exact character spans, so labels cannot drift.
import { PII_TYPES, type PiiType } from '../../core/pii-types.ts'

export type Span = { start: number, end: number, type: PiiType, text: string }
export type LabelledText = { text: string, spans: Span[] }

const MARK = /\[\[([A-Z_]+):([^\]]+)\]\]/g

export function mark(type: PiiType, value: string): string {
  return `[[${type}:${value}]]`
}

export function parseMarkup(source: string): LabelledText {
  let text = ''
  let last = 0
  const spans: Span[] = []
  for (const match of source.matchAll(MARK)) {
    const [whole, type, value] = match
    if (!(PII_TYPES as readonly string[]).includes(type!)) throw new Error(`Unknown type ${type} in: ${source}`)
    text += source.slice(last, match.index)
    spans.push({ start: text.length, end: text.length + value!.length, type: type as PiiType, text: value! })
    text += value
    last = match.index + whole.length
  }
  text += source.slice(last)
  if (text.includes('[[') || text.includes(']]')) throw new Error(`Unclosed markup in: ${source}`)
  return { text, spans }
}
