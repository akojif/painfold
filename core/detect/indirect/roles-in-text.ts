// Finds roles in a text and decides which of them warn:
// - "the only …" before a person or role: "die einzige Ärztin", "the only
//   female CFO" (reason "only"), whatever else is in the sentence.
// - A unique role (a mayor, a school principal, a CEO) linked to a place of
//   any size, an organisation ("Direktorin der Volksschule", "CEO of Acme") or
//   the writer ("ich bin Bürgermeisterin", "as the mayor") (reason "unique-role").
// - A common job title with a place in the same sentence that is not a large
//   city: "Steuerberaterin in Wels" (reason "role-place"); "Lehrerin in Graz"
//   does not warn.
// Places come from the name model; without it, only "the only …" and unique
// roles linked to an organisation or the writer are found.
import type { Detection } from '../types.ts'
import { isLargeCity } from './large-cities.ts'
import { isPersonNoun, MULTI_WORD_PEOPLE, MULTI_WORD_ROLES, roleKind, type RoleKind } from './roles.ts'
import type { IndirectWarning, Span } from './types.ts'

// A word, with a gender-inclusive ending ("Lehrer:in", "Lehrer*innen") and hyphenated parts ("Kfz-Mechanikerin").
const WORD = /\p{L}[\p{L}-]*(?:[:*_]in(?:nen)?)?/gu

// Words that may stand between "the only" and the person: "the only female CFO", "die einzige weibliche Ärztin".
const MODIFIERS = new Set([
  'female', 'male', 'woman', 'young', 'old', 'older', 'other', 'black', 'white', 'trans', 'deaf', 'blind', 'disabled', 'local',
  'weibliche', 'männliche', 'junge', 'jüngere', 'ältere', 'alte', 'andere', 'schwarze', 'gehörlose', 'blinde', 'behinderte',
  'weiblicher', 'männlicher', 'junger', 'älterer', 'alter', 'anderer', 'schwarzer',
])

const ONLY = /(?<![\p{L}])(?:the only|einzige[rnms]?)(?=\s)/giu

// What links a unique role to an organisation, right after it: "der Volksschule", "of Acme", "at the Red Cross".
const ORGANISATION_AFTER = /^\s+(?:of|at|for|von|vom|der|des|bei|beim|im|am)\s+(?:(?:the|die|der|dem|den|unserer?|unseres)\s+)?\p{Lu}/u
// What links it to the writer, right before it: "ich bin", "als", "I am the", "as".
const WRITER_BEFORE = /(?:ich bin|bin|als|arbeite als|i am|i'm|i’m|as|work as)\s+(?:(?:a|an|the|die|der|eine?|einer)\s+)?$/iu

type Word = { start: number, end: number, value: string }

function words(text: string): Word[] {
  return [...text.matchAll(WORD)].map(match => ({ start: match.index, end: match.index + match[0].length, value: match[0] }))
}

/** A multi-word phrase from the list that starts at a position, followed by a non-letter. */
function phraseAt(text: string, start: number, phrases: readonly string[]): string | undefined {
  const rest = text.slice(start, start + 40).toLowerCase()
  return phrases.find(phrase => rest.startsWith(phrase) && !/\p{L}/u.test(rest[phrase.length] ?? ''))
}

/** The sentence around a position: from after the last ". ", "!", "?" or new line before it to the next one. */
function sentenceAround(text: string, start: number, end: number): { start: number, end: number } {
  const before = text.slice(0, start)
  const boundaryBefore = Math.max(before.search(/[.!?]\s+[^.!?]*$|\n[^\n]*$/u), -1)
  const from = boundaryBefore === -1 ? 0 : boundaryBefore + 1
  const after = text.slice(end).search(/[.!?](?:\s|$)|\n/u)
  return { start: from, end: after === -1 ? text.length : end + after }
}

/** "the only …": from "only" or "einzige" to the last person or role word after it. */
function findOnly(text: string): IndirectWarning[] {
  const found: IndirectWarning[] = []
  for (const match of text.matchAll(ONLY)) {
    const start = match.index + (match[0].toLowerCase().startsWith('the ') ? 4 : 0)
    let cursor = match.index + match[0].length
    let end: number | undefined
    for (let step = 0; step < 3; step++) {
      const next = /^\s+(\p{L}[\p{L}-]*(?:[:*_]in(?:nen)?)?)/u.exec(text.slice(cursor))
      if (!next) break
      const wordStart = cursor + next[0].length - next[1]!.length
      const phrase = phraseAt(text, wordStart, [...MULTI_WORD_ROLES, ...MULTI_WORD_PEOPLE])
      const wordEnd = wordStart + (phrase?.length ?? next[1]!.length)
      if (phrase || isPersonNoun(next[1]!)) end = wordEnd
      else if (!MODIFIERS.has(next[1]!.toLowerCase())) break
      cursor = wordEnd
    }
    if (end !== undefined) found.push({ start, end, value: text.slice(start, end), type: 'ROLE', reason: 'only' })
  }
  return found
}

type Role = Word & { kind: RoleKind }

/** Every role in the text, with multi-word roles ("school principal", "tax adviser") before their parts. */
function findRoles(text: string): Role[] {
  const roles: Role[] = []
  let after = 0
  for (const word of words(text)) {
    if (word.start < after) continue
    const phrase = phraseAt(text, word.start, MULTI_WORD_ROLES)
    const value = phrase ? text.slice(word.start, word.start + phrase.length) : word.value
    const kind = roleKind(value)
    if (!kind) continue
    roles.push({ start: word.start, end: word.start + value.length, value, kind })
    after = word.start + value.length
  }
  return roles
}

const asSpan = (place: Detection): Span => ({ start: place.start, end: place.end, value: place.value })

/** Roles that warn, given the places the name model found in the text. */
export function findRoleWarnings(text: string, places: readonly Detection[]): IndirectWarning[] {
  const found = findOnly(text)
  const taken = (start: number, end: number) => found.some(other => start < other.end && end > other.start)

  for (const role of findRoles(text)) {
    if (taken(role.start, role.end)) continue
    const sentence = sentenceAround(text, role.start, role.end)
    const placesNearby = places.filter(place => place.type === 'PLACE' && place.start >= sentence.start && place.end <= sentence.end)
    const nearest = (candidates: readonly Detection[]) => [...candidates].sort((a, b) => Math.abs(a.start - role.start) - Math.abs(b.start - role.start))[0]

    if (role.kind === 'unique') {
      const place = nearest(placesNearby)
      const linked = place || ORGANISATION_AFTER.test(text.slice(role.end)) || WRITER_BEFORE.test(text.slice(Math.max(0, role.start - 30), role.start))
      if (!linked) continue
      found.push({ start: role.start, end: role.end, value: role.value, type: 'ROLE', reason: 'unique-role', ...(place ? { place: asSpan(place) } : {}) })
    }
    else {
      const place = nearest(placesNearby.filter(candidate => !isLargeCity(candidate.value)))
      if (!place) continue
      found.push({ start: role.start, end: role.end, value: role.value, type: 'ROLE', reason: 'role-place', place: asSpan(place) })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}
