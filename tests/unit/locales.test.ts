import { describe, expect, it } from 'vitest'
import de from '../../i18n/locales/de.json'
import en from '../../i18n/locales/en.json'

type Messages = { [key: string]: string | string[] | Messages }

/** Every message as [path, value], with arrays as one entry each. */
function flatten(messages: Messages, prefix = ''): Array<[string, string]> {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') return [[path, value] as [string, string]]
    if (Array.isArray(value)) return value.map((item, i) => [`${path}[${i}]`, item] as [string, string])
    return flatten(value, path)
  })
}

const english = new Map(flatten(en as Messages))
const german = new Map(flatten(de as Messages))
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
