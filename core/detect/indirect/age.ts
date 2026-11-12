// Exact ages, in German and English: "42 Jahre alt", "die 42-Jährige", "mit
// 42 Jahren", "Alter: 42", "ich bin 42", "a 42-year-old", "aged 42", "I'm 42".
// Not ranges or rounded ages ("Mitte 40", "in my forties"), and not the age of
// things or durations ("10-jährige Erfahrung", "a 5-year-old laptop", "seit
// 42 Jahren"): an age before a noun only warns when the noun is a person.
import { isPersonNoun } from './roles.ts'
import type { IndirectWarning } from './types.ts'

// A number that is not part of a longer number, a version or a decimal ("2.42", "1,5").
const NUMBER = String.raw`(?<![\p{L}\p{N}.,/])(\d{1,3})(?![\p{N}]|[.,]\d)`
// What may follow a bare age ("ich bin 42", "I'm 42"): the end, punctuation, "und", "and" or "years".
const BARE_END = String.raw`(?=\s*(?:$|[.,;:!?)]|und\b|and\b|jahre\b|years\b))`

type Rule = { pattern: RegExp, needsPerson?: boolean }

const rule = (pattern: string, needsPerson = false): Rule => ({ pattern: new RegExp(pattern, 'giu'), needsPerson })

// The match's first group is the span that warns.
const RULES: readonly Rule[] = [
  // 42 Jahre alt; 42 Jahre alter Mann (the inflected form needs a person after it).
  rule(String.raw`(${NUMBER}\s*Jahre?\s+alt)(?![\p{L}])`),
  rule(String.raw`(${NUMBER}\s*Jahre?\s+alte[rnms]?)(?![\p{L}])`, true),
  // 42-jährige Kundin (needs a person); die 42-Jährige, capitalised, is a noun and always warns.
  rule(String.raw`(${NUMBER}\s*-?\s*jährige?[rnms]?)(?![\p{L}])`, true),
  // im Alter von 42 (Jahren); mit 42 Jahren (not "mit 5 Jahren Erfahrung").
  rule(String.raw`(?<![\p{L}])im Alter von (${NUMBER}(?:\s+Jahren)?)(?![\p{L}\p{N}])`),
  rule(String.raw`(?<![\p{L}])mit (${NUMBER}\s+Jahren)(?!\s+(?:Berufs)?(?:erfahrung|garantie|laufzeit|betriebszugehörigkeit|mitgliedschaft|verspätung))(?![\p{L}])`),
  // Alter: 42; Age: 42; aged 42; age 42.
  rule(String.raw`(?<![\p{L}])(?:alter|age|aged)\s*:?\s*(${NUMBER})(?![\p{L}\p{N}])`),
  // ich bin 42; I'm 42; I am 42 (only before the end, punctuation, "und", "and" or "years").
  rule(String.raw`(?<![\p{L}])(?:ich bin|bin ich|i'm|i’m|i am)\s+(${NUMBER})${BARE_END}`),
  // 42 years old; 42 yo; 42 y/o.
  rule(String.raw`(${NUMBER}\s*(?:years?\s+old|y\/o|yo|yrs?\s+old))(?![\p{L}])`),
  // a 42-year-old (needs a person after it, or nothing: "I'm a 42-year-old.").
  rule(String.raw`(${NUMBER}\s*-?\s*years?\s*-?\s*old)(?![\p{L}])`, true),
]

/** The word after a position, lowercased, skipping spaces and hyphens ("42-jährige Steuerberaterin" → "steuerberaterin"). */
function nextWord(text: string, from: number): string | undefined {
  return /^[\s-]*([\p{L}:*]+)/u.exec(text.slice(from, from + 40))?.[1]
}

const plausible = (age: number) => age >= 1 && age <= 120

/** Exact ages in a text, as warnings of type AGE. */
export function findAges(text: string): IndirectWarning[] {
  const found: IndirectWarning[] = []
  for (const { pattern, needsPerson } of RULES) {
    for (const match of text.matchAll(pattern)) {
      const span = match[1]!
      const age = Number(/\d+/.exec(span)![0])
      if (!plausible(age)) continue
      const start = match.index + match[0].indexOf(span)
      const end = start + span.length
      if (needsPerson && !/Jährig/u.test(span)) {
        const word = nextWord(text, end)
        // "I'm a 42-year-old." has no noun after it; "a 42-year-old laptop" has a noun that is not a person.
        if (word !== undefined && !isPersonNoun(word)) continue
      }
      if (found.some(other => start < other.end && end > other.start)) continue
      found.push({ start, end, value: span, type: 'AGE', reason: 'age' })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}
