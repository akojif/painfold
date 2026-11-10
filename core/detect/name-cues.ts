// Rules that run after the name model, for what it misses or mislabels in
// feedback: names right after a greeting, a title, a thank-you, a sign-off or
// an introduction ("Hallo Anna", "Frau Novak", "thanks ozan", "LG, Sophie",
// "this is jack"). Tuned on the dev split of the name set only.
//
// After a cue, a name is one or more capitalised words, with particles such as
// "van der" or "al" between them. A lowercase word counts only if it is a known
// first name (first-names.ts), so chat-style "hi anna" is found but "hi, ich
// habe" is not. Words that often follow a cue but are not names ("Hallo Team",
// "Liebe Grüße", "Dear Customer Support") stop the rule, and the model's own
// detections of such words are dropped.
import { isFirstName } from './first-names.ts'
import type { Detection } from './types.ts'

// Each cue and what may stand between it and the name. Greetings, titles and
// introductions are followed directly by the name ("Hallo Anna"). German
// sign-offs and thanks may have a comma or not ("LG Anna", "Danke, Petra").
// English sign-offs need a comma, a colon or a new line, so "the best Tool"
// is not a sign-off. Titles must be written as titles ("Frau", not "frau"), so
// "500 ms Verzögerung" is not one. "ich bin" is usually followed by a noun
// ("Ich bin Lehrerin"), so it counts only before a known first name.
const DIRECT = String.raw`[ \t]+`
const SEPARATED = String.raw`(?:[ \t]*[,:][ \t]*\n?\s*|\s+)`
const PUNCTUATED = String.raw`(?:[ \t]*[,:]\s*|[ \t]*\n\s*)`
const cue = (pattern: string, gap: string, flags = 'giu') => new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${pattern})${gap}`, flags)
const CUES: ReadonlyArray<{ pattern: RegExp, needsFirstName?: boolean }> = [
  { pattern: cue(String.raw`hallo|hello|hi|hey|dear|liebe|lieber|liebes|sehr geehrte[rs]?|guten (?:morgen|tag|abend)|servus|moin|grüß gott|good (?:morning|afternoon|evening)`, DIRECT) },
  { pattern: cue(String.raw`Herrn?|Frau|Mr|Mrs|Ms|Miss|Mx|Dr|Mag|Prof|Ing`, String.raw`\.?[ \t]+`, 'gu') },
  { pattern: cue(String.raw`danke(?: an)?|vielen dank(?: an)?|thanks(?: to)?|thank you|thx|merci`, SEPARATED) },
  { pattern: cue(String.raw`lg|vg|mfg|grüße|gruß|grüsse|gruss|grüssle|mit freundlichen grüßen|(?:viele|liebe|beste|herzliche|schöne) grüße`, SEPARATED) },
  { pattern: cue(String.raw`regards|cheers|best|signed|sincerely|(?:kind|best|warm) regards|best wishes`, PUNCTUATED) },
  { pattern: cue(String.raw`this is|i am|i'm|my name is|mein name ist|ich heiße|ich heisse|hier ist|hier spricht`, DIRECT) },
  { pattern: cue(String.raw`ich bin`, DIRECT), needsFirstName: true },
]

// Words that follow a cue but are not names, lowercase. Also dropped when the
// model labels one of them on its own ("Dear Sir or Madam").
const NOT_NAMES = new Set([
  // Teams, roles and groups of people.
  'team', 'support', 'service', 'kundenservice', 'kundendienst', 'helpdesk', 'hotline', 'admin', 'administrator', 'buchhaltung', 'accounting', 'sales', 'vertrieb', 'management', 'customer', 'customers', 'kunde', 'kundin', 'kunden', 'kollege', 'kollegin', 'kollegen', 'kolleginnen', 'colleague', 'colleagues', 'mitarbeiter', 'mitarbeiterin', 'nutzer', 'nutzerin', 'user', 'users', 'partner', 'community', 'leute', 'people', 'folks', 'guys', 'friends', 'freunde', 'zusammen', 'all', 'everyone', 'everybody', 'there', 'world',
  // Forms of address without a name.
  'sir', 'madam', 'madame', 'damen', 'herren', 'doktor', 'doctor', 'frau', 'herr', 'herrn',
  // Greeting and sign-off words.
  'grüße', 'grüßen', 'gruß', 'grüsse', 'gruss', 'regards', 'wishes', 'thanks', 'danke', 'dank', 'cheers', 'mate', 'best', 'kind', 'viele', 'liebe', 'lieber', 'liebes', 'beste', 'herzliche', 'freundlichen', 'schöne', 'sehr', 'geehrte', 'geehrter', 'geehrtes', 'morgen', 'tag', 'abend', 'morning', 'afternoon', 'evening', 'again', 'voraus', 'advance',
  // Pronouns, articles and other short words.
  'sie', 'ihnen', 'ihr', 'ihre', 'euch', 'dir', 'dich', 'du', 'uns', 'you', 'your', 'yours', 'we', 'us', 'our', 'unser', 'unsere', 'mein', 'meine', 'my', 'the', 'die', 'der', 'das', 'den', 'dem', 'ein', 'eine', 'a', 'an', 'and', 'und', 'or', 'oder', 'for', 'für', 'so', 'very', 'much', 'ok', 'okay',
])
const isNotName = (word: string) => NOT_NAMES.has(word.toLowerCase()) || /(?:team|support|service|abteilung)$/i.test(word)

// Particles inside names: "van der Berg", "Al-Hassan", "bin Rashid", "St. John".
const PARTICLES = new Set(['von', 'van', 'der', 'den', 'de', 'da', 'di', 'du', 'la', 'le', 'al', 'el', 'bin', 'ibn', 'ben', 'ter', 'zu', 'dos', 'st.'])

const WORD = /[\p{L}][\p{L}'’.-]*/uy
const capitalised = (word: string) => /^\p{Lu}/u.test(word)

/** The name that starts at `from`, right after a cue, if there is one. */
function nameAfterCue(text: string, from: number, firstNames: boolean, needsFirstName = false): { start: number, end: number } | undefined {
  let position = from
  let end: number | undefined
  let words = 0
  while (words < 4) {
    WORD.lastIndex = position
    const match = WORD.exec(text)
    if (!match) break
    // A word ends a sentence, or the name, at a full stop that is not part of "St.".
    const word = match[0].endsWith('.') && match[0].toLowerCase() !== 'st.' ? match[0].slice(0, -1) : match[0]
    const lower = word.toLowerCase()
    if (words > 0 && PARTICLES.has(lower) && !capitalised(word)) {
      position = match.index + word.length
      const gap = /^[ \t]+/.exec(text.slice(position))
      if (!gap) break
      position += gap[0].length
      continue
    }
    if (isNotName(word)) break
    const known = firstNames && isFirstName(word, { lowercase: !capitalised(word) })
    if (words === 0 && needsFirstName && !known) break
    const accepted = capitalised(word) || (words === 0 && known)
    if (!accepted) break
    end = match.index + word.length
    words++
    // A lowercase first name is taken on its own: "lg markus" yes, "lg markus huber" only the first name.
    if (!capitalised(word)) break
    const gap = /^(?:[ \t]+|-)/.exec(text.slice(end))
    if (!gap) break
    position = end + gap[0].length
  }
  return end === undefined ? undefined : { start: from, end }
}

/** Names that follow a cue in the text. */
export function cueNames(text: string, { firstNames = true }: { firstNames?: boolean } = {}): Detection[] {
  const found: Detection[] = []
  for (const { pattern, needsFirstName } of CUES) {
    for (const match of text.matchAll(pattern)) {
      const name = nameAfterCue(text, match.index + match[0].length, firstNames, needsFirstName)
      if (name && !found.some(other => other.start < name.end && name.start < other.end)) found.push({ type: 'NAME', ...name, value: text.slice(name.start, name.end) })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}

const SURNAME = /^[ \t]+(\p{Lu}[\p{L}'’-]+)/u

/**
 * Combines the model's names and places with the cue rules:
 * - a model detection that is only a word like "Madam" or "Team" is dropped;
 * - a name found after a cue wins over what the model found inside it, so
 *   "Cheers, Jędrzej Mazur" is a name, not a place;
 * - a model name directly followed by a capitalised word that the model left
 *   out takes that word too ("Mursal" + "Sadat").
 */
export function withNameRules(text: string, model: readonly Detection[], options: { firstNames?: boolean } = {}): Detection[] {
  const cued = cueNames(text, options)
  const kept = model.filter(found => !(/^[\p{L}]+$/u.test(found.value) && isNotName(found.value)))

  const result: Detection[] = []
  for (const name of cued) {
    // Grow the cued name over every model detection it touches.
    let { start, end } = name
    for (const found of kept) if (found.start < end && start < found.end) [start, end] = [Math.min(start, found.start), Math.max(end, found.end)]
    result.push({ type: 'NAME', start, end, value: text.slice(start, end) })
  }
  for (const found of kept) {
    if (result.some(name => name.start < found.end && found.start < name.end)) continue
    let { end } = found
    const surname = found.type === 'NAME' ? SURNAME.exec(text.slice(end)) : null
    if (surname && !isNotName(surname[1]!) && !kept.some(other => other !== found && other.start === end + surname[0].length - surname[1]!.length)) end += surname[0].length
    result.push({ ...found, end, value: text.slice(found.start, end) })
  }
  return result.sort((a, b) => a.start - b.start)
}
