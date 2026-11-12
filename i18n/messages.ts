// The interface text, one file per area and language: i18n/locales/<lang>/<area>.json.
// @nuxtjs/i18n loads a language's files in this order and merges them deeply,
// so one key such as "start" can have most of its text in start.json and the
// sentences on the native-review list in privacy.json (docs/development.md).
// A key is defined in exactly one file; tests/unit/locales.test.ts checks it.
import { readFileSync } from 'node:fs'

export const LANGUAGES = ['en', 'de'] as const
export type Language = typeof LANGUAGES[number]

export const AREAS = ['common', 'start', 'columns', 'review', 'download', 'roadmap', 'accuracy', 'privacy', 'errors'] as const
export type Area = typeof AREAS[number]

/** The files of one language, relative to i18n/locales/, for nuxt.config.ts. */
export const localeFiles = (language: Language): string[] => AREAS.map(area => `${language}/${area}.json`)

export type Messages = { [key: string]: string | string[] | Messages }

const isBlock = (value: unknown): value is Messages => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Merges `from` into `into`, as the i18n module does; a message defined twice is an error. */
export function mergeMessages(into: Messages, from: Messages, path = ''): Messages {
  for (const [key, value] of Object.entries(from)) {
    const where = path ? `${path}.${key}` : key
    const existing = into[key]
    if (existing === undefined) into[key] = isBlock(value) ? mergeMessages({}, value, where) : value
    else if (isBlock(existing) && isBlock(value)) mergeMessages(existing, value, where)
    else throw new Error(`${where} is defined in more than one file`)
  }
  return into
}

/** One area file of a language. */
export function readArea(language: Language, area: Area): Messages {
  return JSON.parse(readFileSync(new URL(`./locales/${language}/${area}.json`, import.meta.url), 'utf8')) as Messages
}

/** All messages of a language, merged from its area files, for scripts and tests. */
export function readMessages(language: Language): Messages {
  return AREAS.reduce<Messages>((merged, area) => mergeMessages(merged, readArea(language, area)), {})
}
