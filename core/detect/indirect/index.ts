// Indirect identifiers (#66): exact ages, "the only …", and roles that point
// to one person. These are warnings, never removed on their own: the review
// shows them, and the reviewer removes or dismisses each one.
import type { Detection } from '../types.ts'
import { findAges } from './age.ts'
import { findRoleWarnings } from './roles-in-text.ts'
import type { IndirectWarning } from './types.ts'

export type { IndirectReason, IndirectType, IndirectWarning } from './types.ts'

/**
 * The warnings in a text. `places` are the name model's detections in the same
 * text (only PLACE is used): a common job title warns only next to a place
 * that is not a large city. Warnings never overlap; the earlier kind wins
 * (ages, then "the only …", then roles).
 */
export function findIndirect(text: string, places: readonly Detection[] = []): IndirectWarning[] {
  const found: IndirectWarning[] = []
  for (const warning of [...findAges(text), ...findRoleWarnings(text, places)]) {
    if (found.every(other => warning.end <= other.start || warning.start >= other.end)) found.push(warning)
  }
  return found.sort((a, b) => a.start - b.start)
}
