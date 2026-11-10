// Turns the name model's per-token labels into names and places in the text.
// The model runs in the detection worker (app/workers/name-model.ts); this file
// is plain code, so the rules below are unit-tested without the model.
//
// What the model returns, per word piece: an entity label such as B-PER (a name
// starts) or I-PER (it continues), and the piece itself ("Brind", "##lecombe").
// Turning that into spans takes three steps the model does not do:
// 1. Group pieces into entities and find each one in the text, in order.
// 2. Extend every entity to whole words: the model sometimes leaves out a word's
//    last piece ("Brindlecomb|e"), which would leave part of a name behind.
// 3. Join entities of the same kind separated only by a hyphen or spaces: the
//    model often splits a double name at the hyphen ("Fenwick" + "Lowe").
import type { Detection } from './types.ts'

export type ModelToken = { entity: string, word: string }

// Persons are names and locations are places; organisations and dates are not
// personal data here (the rule-based detectors cover dates of birth).
const TYPES: Partial<Record<string, 'NAME' | 'PLACE'>> = { PER: 'NAME', LOC: 'PLACE' }

const LETTER = /\p{L}/u
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Groups word pieces into entities: a B- label or a new kind starts one, I- and ## pieces continue it. */
function group(tokens: readonly ModelToken[]): Array<{ label: string, words: string[] }> {
  const entities: Array<{ label: string, words: string[] }> = []
  for (const { entity, word } of tokens) {
    const dash = entity.indexOf('-')
    const prefix = entity.slice(0, dash)
    const label = entity.slice(dash + 1)
    const piece = word.startsWith('##') ? word.slice(2) : word
    const last = entities.at(-1)
    if (last && last.label === label && (prefix === 'I' || word.startsWith('##'))) {
      if (word.startsWith('##')) last.words[last.words.length - 1] += piece
      else last.words.push(piece)
    }
    else {
      entities.push({ label, words: [piece] })
    }
  }
  return entities
}

export function nameDetections(text: string, tokens: readonly ModelToken[]): Detection[] {
  const found: Detection[] = []
  let from = 0
  for (const { label, words } of group(tokens)) {
    // The tokenizer drops spacing around punctuation ("Fenwick - Lowe"), so words may be joined by any spacing.
    const pattern = new RegExp(words.map(escape).join('\\s*'), 'g')
    pattern.lastIndex = from
    const match = pattern.exec(text)
    if (!match) continue
    let start = match.index
    let end = match.index + match[0].length
    while (start > 0 && LETTER.test(text[start - 1]!)) start--
    while (end < text.length && LETTER.test(text[end]!)) end++
    // Search on after the whole word, so the next entity cannot overlap this one.
    from = end
    const type = TYPES[label]
    if (!type) continue

    const last = found.at(-1)
    if (last && last.type === type && /^[\s-]*$/.test(text.slice(last.end, start))) {
      last.end = end
      last.value = text.slice(last.start, end)
    }
    else {
      found.push({ type, start, end, value: text.slice(start, end) })
    }
  }
  return found
}
