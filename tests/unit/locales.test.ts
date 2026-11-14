import { describe, expect, it } from 'vitest'
import { AREAS, mergeMessages, readArea, readMessages, type Messages } from '../../i18n/messages'

/** Every message as [path, value], with arrays as one entry each. */
function flatten(messages: Messages, prefix = ''): Array<[string, string]> {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') return [[path, value] as [string, string]]
    if (Array.isArray(value)) return value.map((item, i) => [`${path}[${i}]`, item] as [string, string])
    return flatten(value, path)
  })
}

const en = readMessages('en') as { app: { name: string, tagline: string } } & Messages
const de = readMessages('de') as { app: { name: string, tagline: string } } & Messages
const english = new Map(flatten(en))
const german = new Map(flatten(de))
const placeholders = (text: string) => [...text.matchAll(/\{[^}]+\}/g)].map(([match]) => match).sort()
const pluralForms = (text: string) => text.split('|').length

describe('locales', () => {
  it('has the app name and tagline', () => {
    expect(en.app.name).toBe('Painfold')
    expect(de.app.name).toBe('Painfold')
    expect(en.app.tagline).not.toBe('')
    expect(de.app.tagline).not.toBe('')
  })

  it('has every message in both English and German (every change adds both)', () => {
    expect([...english.keys()].filter(key => !german.has(key)), 'only in English').toEqual([])
    expect([...german.keys()].filter(key => !english.has(key)), 'only in German').toEqual([])
  })

  it('keeps the same placeholders and plural forms in both languages', () => {
    for (const [key, text] of english) {
      const translated = german.get(key)
      if (translated === undefined) continue
      expect(placeholders(translated), `${key} placeholders`).toEqual(placeholders(text))
      expect(pluralForms(translated), `${key} plural forms`).toBe(pluralForms(text))
    }
  })

  it('has no empty messages', () => {
    for (const [key, text] of [...english, ...german]) expect(text.trim(), key).not.toBe('')
  })
})

// The texts on the native-review list (docs/development.md) live in privacy.json, so a reviewer reads one file per language.
const REVIEW_LIST = [
  'privacy', 'network', 'nameModel', 'smallScreen', 'importNotes', 'nameScan', 'warning', 'report', 'aiPrivacy', 'consent',
  'start.privacy', 'start.privacyAi', 'start.dropOverlay', 'review.limits',
  'columns.warning', 'columns.checkInstead', 'columns.masked', 'columns.reason', 'columns.help',
  'download.names', 'download.mapStays', 'download.reportExplain', 'download.notReviewed',
  'importErrors.unsupported-format',
]
const listed = (path: string) => REVIEW_LIST.some(key => path === key || path.startsWith(`${key}.`) || path.startsWith(`${key}[`))

describe('locale files', () => {
  it('defines every message in exactly one file per language', () => {
    for (const language of ['en', 'de'] as const) {
      expect(() => AREAS.reduce<Messages>((merged, area) => mergeMessages(merged, readArea(language, area)), {})).not.toThrow()
    }
    expect(() => mergeMessages({ a: { b: 'one' } }, { a: { b: 'two' } })).toThrow('a.b is defined in more than one file')
  })

  it('has the same messages in each file in both languages, so a translation is always in the matching file', () => {
    for (const area of AREAS) {
      expect(flatten(readArea('de', area)).map(([key]) => key).sort(), area).toEqual(flatten(readArea('en', area)).map(([key]) => key).sort())
    }
  })

  it('keeps every text on the native-review list in privacy.json, and nothing else there', () => {
    const privacy = flatten(readArea('en', 'privacy')).map(([key]) => key)
    expect(privacy.filter(key => !listed(key))).toEqual([])
    for (const area of AREAS.filter(area => area !== 'privacy')) {
      expect(flatten(readArea('en', area)).map(([key]) => key).filter(listed), area).toEqual([])
    }
    for (const key of REVIEW_LIST) expect(privacy.some(path => path === key || path.startsWith(`${key}.`) || path.startsWith(`${key}[`)), key).toBe(true)
  })
})

// The English interface uses American spelling. Common British spellings,
// matched as whole words in the text (never in keys), so they cannot come back.
const BRITISH = [
  // Not "analyses": also the plural of analysis.
  /\banalys(?:e|ed|ing)\b/i,
  /\b\w*(?:organis|recognis|optimis|summaris|customis|prioritis|authoris|initialis|minimis|normalis|visualis|anonymis|pseudonymis|standardis|categoris|synchronis|apologis|finalis|utilis|realis|memoris|personalis|emphasis(?:e|ed|es|ing))(?:e|ed|es|ing|ation|ations|er|ers)\b/i,
  /\b(?:behaviour|colour|favour|honour|labour|neighbour|flavour|humour|rumour)\w*\b/i,
  /\b(?:cancelled|cancelling|labelled|labelling|modelled|modelling|travelled|travelling|levelled|signalled|totalled)\b/i,
  /\b(?:centre|centres|licence|licences|defence|offence|catalogue|dialogue|programme|programmes|grey|whilst|amongst|judgement|cheque|fulfil|enrol|enrolment|practise|metre|litre|fibre|ageing|acknowledgement)\b/i,
]

describe('American English', () => {
  it('the English interface text has no British spellings', () => {
    const found = [...english].flatMap(([key, text]) => BRITISH.flatMap(pattern => text.match(pattern)?.map(word => `${key}: ${word}`) ?? []))
    expect(found).toEqual([])
  })

  it('the check catches the spellings it is meant to', () => {
    const caught = (text: string) => BRITISH.some(pattern => pattern.test(text))
    for (const text of ['Analysed 200 texts', 'not analysed yet', 'your organisation', 'expected behaviour', 'Download cancelled.', 'colours', 'a grey area', 'we recognised it'])
      expect(caught(text), text).toBe(true)
    for (const text of ['Analyzed 200 texts', 'analysis', 'analyses', 'otherwise', 'advise', 'a precise surprise', 'emphasis', 'license', 'canceled', 'organization'])
      expect(caught(text), text).toBe(false)
  })
})
