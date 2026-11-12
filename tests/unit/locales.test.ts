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
  'privacy', 'network', 'nameModel', 'smallScreen', 'importNotes', 'nameScan', 'warning', 'report',
  'start.privacy', 'start.dropOverlay', 'review.limits',
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
