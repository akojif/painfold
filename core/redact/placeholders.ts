import type { Detection } from '../detect/types.ts'
import type { PiiType } from '../pii-types.ts'

/**
 * Values that differ only in ways that do not change who they point to share
 * a placeholder: case in emails and IP addresses, scheme and host case in URLs.
 * Detectors added later (phone, IBAN) extend this with their own rules.
 */
export function normalizeValue(type: PiiType, value: string): string {
  switch (type) {
    case 'EMAIL':
    case 'IP':
      return value.toLowerCase()
    case 'URL':
      return value.replace(/^(?:https?:\/\/)?[^/?#]+/i, origin => origin.toLowerCase().replace(/^https?:\/\//, ''))
    default:
      return value.replace(/\s+/g, ' ').trim()
  }
}

// Placeholder labels read as plain words where the internal type name does not.
const LABELS: Partial<Record<PiiType, string>> = { URL: 'LINK' }

/** The word inside a placeholder, e.g. EMAIL in [EMAIL_3] or LINK for a URL. */
export function placeholderLabel(type: PiiType): string {
  return LABELS[type] ?? type
}

/** Identifies a value for decisions and placeholders: the same key means the same value. */
export function valueKey(type: PiiType, value: string): string {
  return `${type}\u0000${normalizeValue(type, value)}`
}

/**
 * Hands out placeholders such as [EMAIL_3]: numbered per type in the order
 * values are first seen, and the same for every occurrence of the same value.
 * The map from value to placeholder stays in memory and is never exported.
 */
export class PlaceholderMap {
  private readonly byKey = new Map<string, string>()
  private readonly counts = new Map<PiiType, number>()

  placeholderFor(type: PiiType, value: string): string {
    const key = valueKey(type, value)
    let placeholder = this.byKey.get(key)
    if (!placeholder) {
      const next = (this.counts.get(type) ?? 0) + 1
      this.counts.set(type, next)
      placeholder = `[${placeholderLabel(type)}_${next}]`
      this.byKey.set(key, placeholder)
    }
    return placeholder
  }

  get size(): number {
    return this.byKey.size
  }
}

/** Replaces each detection with its placeholder. Detections must not overlap. */
export function redact(text: string, detections: readonly Detection[], placeholders: PlaceholderMap): string {
  let result = ''
  let last = 0
  for (const found of [...detections].sort((a, b) => a.start - b.start)) {
    if (found.start < last) throw new Error('Detections overlap')
    result += text.slice(last, found.start) + placeholders.placeholderFor(found.type, found.value)
    last = found.end
  }
  return result + text.slice(last)
}
