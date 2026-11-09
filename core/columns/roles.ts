// Default roles for the columns of an imported file:
//   scan  check the text for personal data and replace it
//   keep  export unchanged
//   drop  leave out of the export
// A column whose header looks personal (name, email, Kunde, Vorname, ...) is
// dropped by default; the user can change any role before anything is exported.

export type ColumnRole = 'scan' | 'keep' | 'drop'

export type RoleSuggestion
  = | { role: 'drop', reason: 'personal-header', term: string }
    | { role: 'scan', reason: 'text' }
    | { role: 'keep', reason: 'no-text' }

// Header words that identify a person or their contact details, in English and German.
const PERSONAL_WORDS = new Set([
  'name', 'firstname', 'lastname', 'surname', 'fullname', 'givenname', 'familyname', 'displayname', 'username', 'login',
  'vorname', 'nachname', 'familienname', 'benutzername',
  'email', 'mail', 'emailaddress', 'phone', 'telephone', 'tel', 'mobile', 'cell', 'fax',
  'telefon', 'telefonnummer', 'handy', 'handynummer', 'mobil', 'mobilnummer',
  'address', 'street', 'zip', 'zipcode', 'postcode', 'postalcode', 'city', 'town',
  'adresse', 'anschrift', 'strasse', 'hausnummer', 'plz', 'postleitzahl', 'ort', 'wohnort', 'stadt',
  'birth', 'birthday', 'birthdate', 'dob', 'geburtsdatum', 'geburtstag', 'geboren',
  'ssn', 'svnr', 'svnummer', 'sozialversicherungsnummer', 'versicherungsnummer', 'personalnummer', 'steuernummer', 'taxid',
  'iban', 'kontonummer', 'ip', 'ipaddress', 'uid',
  'author', 'reporter', 'assignee', 'agent', 'employee', 'signature', 'bearbeiter', 'mitarbeiter', 'ansprechpartner',
])

// Compound words ending in one of these are personal unless the start says
// otherwise ("Kundenname" is, "Produktname" is not).
const PERSONAL_ENDINGS = ['name', 'email', 'mail', 'telefon', 'telefonnummer', 'handynummer', 'mobilnummer', 'adresse', 'address', 'strasse', 'geburtsdatum']

// "name" after one of these describes a thing, not a person.
const THING_QUALIFIERS = new Set([
  'product', 'file', 'project', 'company', 'plan', 'channel', 'brand', 'app', 'item', 'team', 'group', 'category',
  'tag', 'event', 'feature', 'sheet', 'column', 'domain', 'host', 'server', 'device', 'browser', 'page', 'campaign',
  'produkt', 'projekt', 'datei', 'firma', 'firmen', 'kanal', 'tarif', 'kategorie', 'gruppe', 'kampagne', 'marke',
])

// Words for "who" that are personal on their own or with an ID ("customer",
// "Kundennummer"), but only describe a group otherwise ("customer_segment",
// "Kundengruppe", "Kundenfeedback").
// Longest first, so "Kundennummer" splits as "kunden" + "nummer".
const WHO_WORDS = ['customer', 'benutzer', 'contact', 'kontakt', 'kunden', 'client', 'person', 'kunde', 'user']
const ID_WORDS = new Set(['id', 'nr', 'no', 'number', 'nummer', 'num'])

const TRANSLITERATION: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }

/** Splits a header into lowercase ASCII words: "customerEmail" and "Customer E-Mail" give ["customer", "email"]. */
export function headerWords(header: string): string[] {
  return header
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[äöüß]/g, letter => TRANSLITERATION[letter]!)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\be[\s_-]+mail/g, 'email')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** The word that makes a header look personal, or undefined. */
export function personalHeaderTerm(header: string): string | undefined {
  const words = headerWords(header)
  // Hyphenated compounds such as "SV-Nummer" only match as a whole.
  const joined = words.join('')
  if (PERSONAL_WORDS.has(joined)) return joined

  for (const [i, word] of words.entries()) {
    if (word === 'name' && i > 0 && THING_QUALIFIERS.has(words[i - 1]!)) continue
    if (PERSONAL_WORDS.has(word)) return word

    const ending = PERSONAL_ENDINGS.find(end => word.endsWith(end) && word.length > end.length)
    if (ending && !THING_QUALIFIERS.has(word.slice(0, -ending.length))) return word

    const who = WHO_WORDS.find(start => word === start || word.startsWith(start))
    if (who) {
      const rest = word.slice(who.length)
      const othersAreIds = words.every((other, j) => j === i || ID_WORDS.has(other))
      if ((rest === '' && othersAreIds) || ID_WORDS.has(rest)) return word
    }
  }
  return undefined
}

export function suggestRole(header: string, values: readonly string[]): RoleSuggestion {
  const term = personalHeaderTerm(header)
  if (term) return { role: 'drop', reason: 'personal-header', term }
  if (values.some(value => /\p{L}/u.test(value))) return { role: 'scan', reason: 'text' }
  return { role: 'keep', reason: 'no-text' }
}

export function suggestRoles(table: { columns: string[], rows: string[][] }): RoleSuggestion[] {
  return table.columns.map((column, i) => suggestRole(column, table.rows.map(row => row[i] ?? '')))
}

const MIN_FEEDBACK_LENGTH = 20

/**
 * The column most likely to hold the feedback: the non-personal text column
 * with the longest average entry, if that average is at least a short sentence.
 */
export function guessFeedbackColumn(table: { columns: string[], rows: string[][] }): number | undefined {
  const suggestions = suggestRoles(table)
  let best: { index: number, average: number } | undefined
  for (const [index, suggestion] of suggestions.entries()) {
    if (suggestion.role !== 'scan') continue
    const filled = table.rows.map(row => row[index]?.trim() ?? '').filter(Boolean)
    if (filled.length === 0) continue
    const average = filled.reduce((sum, value) => sum + value.length, 0) / filled.length
    if (average >= MIN_FEEDBACK_LENGTH && (!best || average > best.average)) best = { index, average }
  }
  return best?.index
}
