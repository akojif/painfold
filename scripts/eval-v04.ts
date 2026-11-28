// The v0.4 analysis test set (pre-registered in data/eval/analysis/runs-log.md):
// selecting the English texts from the CFPB complaint database, and the slot
// plan, request and checks for the German texts generated from the committed
// brief (data/eval/analysis/v04/german-brief.md). Plain functions, so they are
// tested without a network. The scripts that use them (eval-v04-select.ts,
// eval-v04-generate.ts) write the texts only into PRIVATE_DIR, which git
// ignores, and print counts, never a text.
import { seededRandom, type Random } from './fake-data/random.ts'
import { detect } from '../core/detect/index.ts'

export const PRIVATE_DIR = 'data/eval/analysis/v04/private'
export const SEED = 20261121
export const TEST_COUNT = 100
export const RESERVE_COUNT = 20

/** Fisher–Yates with the seeded generator, so a draw is the same on every run. */
export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = random.int(0, i)
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

// ---------------------------------------------------------------------------
// English: CFPB complaint narratives
// ---------------------------------------------------------------------------

export type CfpbRecord = { id: string, text: string, product: string, company: string, date: string }

export const CFPB_RULES = {
  year: 2025,
  minLength: 150,
  maxLength: 1500,
  perCompany: 2,
  /** Days of the year queried, drawn with the seed; each gives up to `perDay` complaints. */
  days: 120,
  perDay: 100,
} as const

const API = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/'

/** The days queried, the same on every run: CFPB_RULES.days dates in CFPB_RULES.year, sorted. */
export function cfpbDays(seed = SEED): string[] {
  const random = seededRandom(seed)
  const all = Array.from({ length: 365 }, (_, index) => new Date(Date.UTC(CFPB_RULES.year, 0, 1 + index)).toISOString().slice(0, 10))
  return shuffled(all, random).slice(0, CFPB_RULES.days).sort()
}

/** The search API request for one day's complaints with a published narrative. */
export function cfpbDayUrl(day: string): string {
  const query = new URLSearchParams({
    has_narrative: 'true',
    date_received_min: day,
    date_received_max: day,
    size: String(CFPB_RULES.perDay),
    sort: 'created_date_desc',
    no_aggs: 'true',
    format: 'json',
  })
  return `${API}?${query}`
}

type CfpbSource = { complaint_id?: unknown, complaint_what_happened?: unknown, product?: unknown, company?: unknown, date_received?: unknown }

/** The records in one API answer. Accepts the search shape (hits.hits[]._source) and a plain list; anything else is an error that names the shape, never a text. */
export function cfpbRecords(answer: unknown): CfpbRecord[] {
  const list: unknown[] = Array.isArray(answer)
    ? answer
    : ((answer as { hits?: { hits?: unknown[] } })?.hits?.hits ?? [])
  if (!Array.isArray(answer) && !(answer as { hits?: unknown })?.hits) throw new Error(`Unexpected CFPB answer: keys ${Object.keys(answer ?? {}).join(', ')}`)
  return list.flatMap((entry) => {
    const source = ((entry as { _source?: CfpbSource })._source ?? entry) as CfpbSource
    const text = typeof source.complaint_what_happened === 'string' ? source.complaint_what_happened.trim() : ''
    if (!text) return []
    return [{
      id: String(source.complaint_id ?? ''),
      text,
      product: String(source.product ?? ''),
      company: String(source.company ?? ''),
      date: String(source.date_received ?? '').slice(0, 10),
    }]
  }).filter(record => record.id !== '')
}

/**
 * The English test texts and their reserve, by the pre-registered rules:
 * a narrative from CFPB_RULES.year between minLength and maxLength
 * characters, no duplicate texts, at most perCompany per company, spread
 * across products (round robin over the products, in a seeded order), drawn
 * with the seed.
 */
export function selectCfpb(records: readonly CfpbRecord[], seed = SEED, count = TEST_COUNT, reserve = RESERVE_COUNT): { test: CfpbRecord[], reserve: CfpbRecord[] } {
  const random = seededRandom(seed)
  const seen = new Set<string>()
  const eligible = [...records]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((record) => {
      const key = record.text.replace(/\s+/g, ' ').toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return record.date.startsWith(String(CFPB_RULES.year))
        && record.text.length >= CFPB_RULES.minLength && record.text.length <= CFPB_RULES.maxLength
    })
  const byProduct = new Map<string, CfpbRecord[]>()
  for (const record of shuffled(eligible, random)) byProduct.set(record.product, [...(byProduct.get(record.product) ?? []), record])
  const products = shuffled([...byProduct.keys()].sort(), random)
  const perCompany = new Map<string, number>()
  const picked: CfpbRecord[] = []
  while (picked.length < count + reserve && products.some(product => (byProduct.get(product) ?? []).length > 0)) {
    for (const product of products) {
      const queue = byProduct.get(product)!
      while (queue.length > 0) {
        const record = queue.shift()!
        if ((perCompany.get(record.company) ?? 0) >= CFPB_RULES.perCompany) continue
        perCompany.set(record.company, (perCompany.get(record.company) ?? 0) + 1)
        picked.push(record)
        break
      }
      if (picked.length >= count + reserve) break
    }
  }
  return { test: picked.slice(0, count), reserve: picked.slice(count, count + reserve) }
}

/** CFPB's own masks (XX/XX/XXXX, XXXX, {$0.00}) count as already removed. */
export const cfpbMasked = (text: string, start: number, end: number) => /^[X/\s{}$.0-9]*$/.test(text.slice(start, end)) && /X/.test(text.slice(start, end))

// ---------------------------------------------------------------------------
// German: the slot plan, the request and the checks (the approved brief)
// ---------------------------------------------------------------------------

export const CHANNELS = [
  { key: 'support', count: 30, de: 'Nachricht an den Kundenservice (E-Mail oder Kontaktformular)' },
  { key: 'review', count: 25, de: 'Bewertung im App-Store' },
  { key: 'chat', count: 25, de: 'Chatnachricht an den Kundenservice' },
  { key: 'survey', count: 20, de: 'Kommentar in einer Umfrage nach „Wie wahrscheinlich ist es, dass Sie uns weiterempfehlen?“' },
] as const

export const LENGTHS = [
  { key: 'short', count: 25, min: 1, max: 120, de: 'kurz, höchstens 120 Zeichen' },
  { key: 'medium', count: 50, min: 120, max: 600, de: 'mittel, 120 bis 600 Zeichen' },
  { key: 'long', count: 25, min: 600, max: 1500, de: 'lang, 600 bis 1.500 Zeichen' },
] as const

export const VARIETIES = [
  { key: 'de-DE', count: 50, de: 'Deutsch, wie in Deutschland' },
  { key: 'de-AT', count: 35, de: 'Deutsch, wie in Österreich (etwa Erlagschein, Bankomat, KSV, Jänner)' },
  { key: 'mixed', count: 15, de: 'Deutsch mit englischen Wörtern oder halb englischen Sätzen' },
] as const

export const TOPICS = [
  'Anmeldung im Online-Banking', 'Freigabe von Zahlungen in der App (TAN, Push)', 'Karte sperren und ersetzen', 'Überweisung dauert zu lange',
  'Echtzeitüberweisung und ihre Gebühren', 'höhere Kontoführungsgebühren', 'Dispozinsen', 'Dauer eines Kreditantrags',
  'Beratung zur Baufinanzierung', 'Schließung einer Filiale', 'Geldautomaten (Standort, Verfügbarkeit, Gebühren)', 'Kontowechselservice',
  'Steuerbescheinigung (Deutschland: Jahressteuerbescheinigung; Österreich: KESt)', 'Depot und Sparplan', 'Bezahlen mit dem Handy (Apple Pay, Google Pay)', 'Kreditkarte im Ausland',
  'Phishing und Betrugsverdacht', 'Wartezeit an der Hotline', 'der Chatbot', 'Adressänderung',
  'Gemeinschaftskonto', 'Kinder- oder Jugendkonto', 'Kontoauszüge als PDF und elektronisches Postfach', 'ein App-Update, das etwas verändert hat',
  'Barrierefreiheit (Schriftgröße, Screenreader)',
] as const

export const FEATURES = [
  { key: 'ordinary', count: 40, de: 'Etwas funktioniert nicht oder stört; oft wird klar, was die Person erreichen wollte.' },
  { key: 'wishAsQuestion', count: 15, de: 'Ein Wunsch, aber als Frage oder als Fehlen formuliert, nicht als direkte Bitte.' },
  { key: 'praiseOnly', count: 10, de: 'Nur Lob, kein Wunsch und kein Problem.' },
  { key: 'severalGoals', count: 15, de: 'Die Person will zwei oder drei verschiedene Dinge erledigen.' },
  { key: 'nothing', count: 10, de: 'Eine rein sachliche Nachricht ohne Problem, ohne Wunsch und ohne Ziel, etwa eine Bestätigung.' },
  { key: 'cleaned', count: 10, de: 'Enthält ein bis drei Platzhalter für personenbezogene Daten, etwa [NAME_1] oder [IBAN_1].' },
] as const

export const TONES = ['sachlich', 'verärgert', 'freundlich', 'ironisch'] as const

export type Slot = {
  slot: number
  channel: typeof CHANNELS[number]
  length: typeof LENGTHS[number]
  variety: typeof VARIETIES[number]
  topic: string
  feature: typeof FEATURES[number]
  tone: typeof TONES[number]
}

const expand = <T extends { count: number }>(items: readonly T[]) => items.flatMap(item => Array.from({ length: item.count }, () => item))

/** The 100 slots, with every share exact: each list is expanded to its counts and shuffled on its own, then zipped. */
export function buildSlots(seed = SEED): Slot[] {
  const random = seededRandom(seed)
  const channels = shuffled(expand(CHANNELS), random)
  const lengths = shuffled(expand(LENGTHS), random)
  const varieties = shuffled(expand(VARIETIES), random)
  const topics = shuffled(TOPICS.flatMap(topic => [topic, topic, topic, topic]), random)
  const features = shuffled(expand(FEATURES), random)
  return Array.from({ length: TEST_COUNT }, (_, index) => ({
    slot: index + 1,
    channel: channels[index]!,
    length: lengths[index]!,
    variety: varieties[index]!,
    topic: topics[index]!,
    feature: features[index]!,
    tone: random.pick(TONES),
  }))
}

/** The system message, as approved: placeholders only in the "already cleaned" orders; every other text holds no personal data at all. */
export const SYSTEM_MESSAGE = `Du schreibst realistische, erfundene Kundenrückmeldungen an eine Bank, für einen Testdatensatz. Die Bank heißt „Hafenbank“; es ist eine erfundene Bank. Schreibe jede Rückmeldung so, wie eine echte Kundin oder ein echter Kunde sie schreiben würde: mit eigenen Worten, Tippfehlern, wo sie natürlich sind, ohne Überschrift, ohne Erklärung und ohne Antwort der Bank.

Regeln:
- Erfinde keine echten Personen, Firmen außer der Hafenbank, Kontonummern oder Adressen. Nenne keine echte Bank.
- Nur Aufträge mit der Besonderheit „Enthält ein bis drei Platzhalter“ enthalten Platzhalter wie [NAME_1], [IBAN_1], [EMAIL_1], [PHONE_1] oder [ADDRESS_1], an der Stelle, wo personenbezogene Daten stünden.
- Alle anderen Rückmeldungen enthalten keinerlei personenbezogene Daten: keine Namen, keine Kontonummern, keine Adressen, keine E-Mail-Adressen, keine Telefonnummern und auch keine Platzhalter.
- Halte dich genau an Kanal, Länge, Sprachvariante, Thema, Ton und Besonderheit jedes Auftrags.
- Jede Rückmeldung steht für sich; sie wiederholen einander nicht.

Antworte nur mit JSON in dieser Form: {"texts": [{"slot": <Nummer>, "text": "<Rückmeldung>"}]}`

/** The user message for one batch of slots. */
export function batchMessage(slots: readonly Slot[]): string {
  const orders = slots.map(slot => `Auftrag ${slot.slot}: Kanal: ${slot.channel.de}. Länge: ${slot.length.de}. Sprachvariante: ${slot.variety.de}. Thema: ${slot.topic}. Ton: ${slot.tone}. Besonderheit: ${slot.feature.de}`)
  return `Schreibe ${slots.length} Rückmeldungen.\n\n${orders.join('\n')}`
}

export const PLACEHOLDER = /\[[A-Z]+_\d+\]/g
/** Real banks in Germany and Austria that must not appear (a fixed list; the brief's bank is invented). */
export const REAL_BANKS = ['Sparkasse', 'Volksbank', 'Raiffeisen', 'Deutsche Bank', 'Commerzbank', 'Postbank', 'ING', 'DKB', 'Comdirect', 'N26', 'Erste Bank', 'BAWAG', 'Bank Austria', 'UniCredit', 'Hypo', 'Santander', 'Targobank', 'Consorsbank', 'Revolut'] as const

export type CheckFailure = 'missing' | 'length' | 'placeholdersMissing' | 'placeholdersNotAllowed' | 'personalData' | 'realBank' | 'duplicate'

const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
const trigrams = (text: string) => {
  const list = words(text)
  return new Set(list.slice(2).map((_, index) => list.slice(index, index + 3).join(' ')))
}
/** Near-identical: more than 60 % of word trigrams shared. */
export function nearDuplicate(a: string, b: string): boolean {
  const x = trigrams(a)
  const y = trigrams(b)
  if (x.size === 0 || y.size === 0) return a.trim().toLowerCase() === b.trim().toLowerCase()
  let shared = 0
  for (const gram of x) if (y.has(gram)) shared++
  return shared / Math.min(x.size, y.size) > 0.6
}

/** Everything wrong with one generated text for its slot; an empty list means it passes. Never returns the text. */
export function checkText(slot: Slot, text: string | undefined, accepted: readonly string[]): CheckFailure[] {
  if (!text || !text.trim()) return ['missing']
  const failures: CheckFailure[] = []
  const tolerance = 0.2
  if (text.length < slot.length.min * (1 - tolerance) || text.length > slot.length.max * (1 + tolerance)) failures.push('length')
  const placeholders = text.match(PLACEHOLDER) ?? []
  if (slot.feature.key === 'cleaned' && (placeholders.length < 1 || placeholders.length > 3)) failures.push('placeholdersMissing')
  if (slot.feature.key !== 'cleaned' && placeholders.length > 0) failures.push('placeholdersNotAllowed')
  const withoutPlaceholders = text.replace(PLACEHOLDER, ' ')
  if (detect(withoutPlaceholders).length > 0) failures.push('personalData')
  if (REAL_BANKS.some(bank => new RegExp(`\\b${bank}\\b`, 'i').test(text))) failures.push('realBank')
  if (accepted.some(other => nearDuplicate(other, text))) failures.push('duplicate')
  return failures
}

export type SlotOutcome = { slot: Slot, regenerated: boolean, dropped: boolean }

/** Regenerated and dropped slots by language variety and by special feature, counts only, and whether to stop before labelling (more than 2 of any group's slots dropped). */
export function dropReport(outcomes: readonly SlotOutcome[]) {
  const count = (pick: (outcome: SlotOutcome) => string, keys: readonly string[]) => Object.fromEntries(keys.map(key => [key, {
    regenerated: outcomes.filter(outcome => pick(outcome) === key && outcome.regenerated).length,
    dropped: outcomes.filter(outcome => pick(outcome) === key && outcome.dropped).length,
  }]))
  const byVariety = count(outcome => outcome.slot.variety.key, VARIETIES.map(variety => variety.key))
  const byFeature = count(outcome => outcome.slot.feature.key, FEATURES.map(feature => feature.key))
  const tooMany = [...Object.entries(byVariety), ...Object.entries(byFeature)].filter(([, value]) => value.dropped > 2).map(([key]) => key)
  return { byVariety, byFeature, stop: tooMany.length > 0, tooMany }
}

/** One line of the private items file, in the shape make_sheets.py and the labels converter read. */
export const itemLine = (id: string, lang: 'en' | 'de', text: string) => JSON.stringify({ id, lang, split: 'test', text })
