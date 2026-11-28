// Indirect identifiers: text that is not personal data on its own, but can
// point to one person together with what else is known ("the only female CFO
// in Wels", "a 42-year-old tax adviser in Wels"). Painfold warns about them
// and never removes them on its own; the reviewer decides.

/** What a warning would be replaced with if the reviewer removes it. */
export type IndirectType = 'AGE' | 'ROLE'

/**
 * Why the text warns:
 * - age: an exact age ("42 Jahre alt", "a 42-year-old").
 * - only: "the only …" ("die einzige Ärztin", "the only female CFO").
 * - role-place: a common job title with a place that is not a large city.
 * - unique-role: a role one person holds in a place or organisation (a mayor, a bishop, a school principal, the head of a named organisation), whatever the place.
 */
export type IndirectReason = 'age' | 'only' | 'role-place' | 'unique-role'

export type IndirectWarning = {
  start: number
  end: number
  value: string
  type: IndirectType
  reason: IndirectReason
  /** For a role with a place: the place it is linked to, so the interface can say when that place is removed. */
  place?: { start: number, end: number, value: string }
}

export type Span = { start: number, end: number, value: string }
