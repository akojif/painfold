import { describe, expect, it } from 'vitest'
import { findIndirect } from '../../core/detect/indirect'
import { isLargeCity } from '../../core/detect/indirect/large-cities'
import { isPersonNoun, normaliseRole, roleKind } from '../../core/detect/indirect/roles'
import type { Detection } from '../../core/detect/types'

// All examples are invented. Places stand in for the name model's detections.
function place(text: string, value: string): Detection {
  const start = text.indexOf(value)
  return { type: 'PLACE', start, end: start + value.length, value }
}

/** "reason:value" for each warning, the place after "@" when there is one. */
function warnings(text: string, ...places: string[]): string[] {
  return findIndirect(text, places.map(value => place(text, value)))
    .map(warning => `${warning.reason}:${warning.value}${warning.place ? `@${warning.place.value}` : ''}`)
}

describe('exact ages', () => {
  it.each([
    ['Ich bin 42 Jahre alt und wohne hier.', 'age:42 Jahre alt'],
    ['Die 42-Jährige beschwerte sich.', 'age:42-Jährige'],
    ['Eine 42-jährige Kundin hat angerufen.', 'age:42-jährige'],
    ['Ein 67 Jahre alter Pensionist kam vorbei.', 'age:67 Jahre alter'],
    ['Mit 67 Jahren lerne ich das nicht mehr.', 'age:67 Jahren'],
    ['Seit ich im Alter von 70 Jahren in Pension bin.', 'age:70 Jahren'],
    ['Alter: 42', 'age:42'],
    ['Ich bin 42, und das Formular ist zu klein.', 'age:42'],
    ['I am a 42-year-old nurse.', 'age:42-year-old'],
    ["I'm 42 and tired of this.", 'age:42'],
    ['My mother is 81 years old.', 'age:81 years old'],
    ['Aged 35, I still could not find the button.', 'age:35'],
    ['My 7-year-old son broke it.', 'age:7-year-old'],
  ])('%s', (text, expected) => {
    expect(warnings(text)).toEqual([expected])
  })

  it.each([
    'Wir bieten 10-jährige Erfahrung.',
    'Mit 5 Jahren Erfahrung im Support kenne ich das.',
    'Das 5 Jahre alte Gerät ist kaputt.',
    'My 5-year-old laptop broke.',
    "I'm 5 minutes late.",
    'Version 2.42 crashes.',
    'Seit 42 Jahren Kundin.',
    'Bestellung 42 kam nicht an.',
    'I am 200 years old, said the tortoise.',
    'Mitte 40 und immer noch keine Lösung.',
  ])('not an age: %s', (text) => {
    expect(warnings(text)).toEqual([])
  })
})

describe('"the only …"', () => {
  it.each([
    ['Ich bin die einzige Ärztin in Wels.', 'only:einzige Ärztin'],
    ['As the only female CFO in Wels, I need this.', 'only:only female CFO'],
    ['Ich bin der einzige Kunde mit diesem Problem.', 'only:einzige Kunde'],
    ['I am the only woman on the team.', 'only:only woman'],
    ['Als einzige weibliche Tischlerin hier fällt das auf.', 'only:einzige weibliche Tischlerin'],
  ])('%s', (text, expected) => {
    expect(warnings(text, ...(text.includes('Wels') ? ['Wels'] : []))).toEqual([expected])
  })

  it.each([
    'The only problem my customer has is speed.',
    'Das einzige Problem ist die Ladezeit.',
    'The only way to export is CSV.',
  ])('not a person: %s', (text) => {
    expect(warnings(text)).toEqual([])
  })
})

describe('roles with places', () => {
  it('warns on a common job title next to a place that is not a large city, linked to the place', () => {
    expect(warnings('Ich bin Steuerberaterin in Wels.', 'Wels')).toEqual(['role-place:Steuerberaterin@Wels'])
    expect(warnings('I work as a tax adviser in Bad Ischl.', 'Bad Ischl')).toEqual(['role-place:tax adviser@Bad Ischl'])
  })

  it('does not warn on a common job title next to a large city', () => {
    expect(warnings('Ich bin Lehrerin in Graz.', 'Graz')).toEqual([])
    expect(warnings('Ich bin Lehrer:in in Klagenfurt.', 'Klagenfurt')).toEqual([])
    expect(warnings('I am a nurse in Vienna.', 'Vienna')).toEqual([])
  })

  it('needs the place in the same sentence', () => {
    expect(warnings('Ich bin Steuerberaterin. Wels ist schön.', 'Wels')).toEqual([])
  })

  it('does not warn on a common job title without a place', () => {
    expect(warnings('Ich bin Steuerberaterin und brauche einen Export.')).toEqual([])
  })

  it('warns on unique roles next to any place, also a large city', () => {
    expect(warnings('Ich bin Bürgermeisterin von Graz.', 'Graz')).toEqual(['unique-role:Bürgermeisterin@Graz'])
    expect(warnings('Die Volksschuldirektorin in Wien war nett.', 'Wien')).toEqual(['unique-role:Volksschuldirektorin@Wien'])
  })

  it('warns on unique roles linked to an organisation or the writer, without a place', () => {
    expect(warnings('Als Direktorin der Volksschule Hintertux brauche ich das.')).toEqual(['unique-role:Direktorin'])
    expect(warnings('I am the mayor and this is broken.')).toEqual(['unique-role:mayor'])
    expect(warnings('As head teacher of St Aldric Primary I need a bulk export.')).toEqual(['unique-role:head teacher'])
  })

  it('does not warn on a unique role mentioned in passing', () => {
    expect(warnings('Our CEO should read this.')).toEqual([])
  })
})

describe('roles', () => {
  it('reads gender-inclusive spellings as the feminine form', () => {
    for (const word of ['Lehrer:in', 'Lehrer*in', 'Lehrer_in', 'LehrerIn', 'Lehrerinnen']) expect(normaliseRole(word)).toBe('lehrerin')
  })

  it('sorts roles into common and unique, including German compounds', () => {
    expect(roleKind('Steuerberaterin')).toBe('common')
    expect(roleKind('Ärztin')).toBe('common')
    expect(roleKind('Kundenberaterin')).toBe('common')
    expect(roleKind('Bürgermeisterin')).toBe('unique')
    expect(roleKind('Volksschuldirektorin')).toBe('unique')
    expect(roleKind('school principal')).toBe('unique')
    expect(roleKind('Kochtopf')).toBeUndefined()
    expect(roleKind('Problem')).toBeUndefined()
  })

  it('counts people who are not a job as persons', () => {
    expect(isPersonNoun('Kundin')).toBe(true)
    expect(isPersonNoun('woman')).toBe(true)
    expect(isPersonNoun('laptop')).toBe(false)
  })
})

describe('large cities', () => {
  it('lists the six Austrian municipalities above 100,000 (Statistik Austria), and no others', () => {
    for (const city of ['Wien', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt']) expect(isLargeCity(city), city).toBe(true)
    for (const town of ['Villach', 'Wels', 'Sankt Pölten', 'Dornbirn', 'Steyr']) expect(isLargeCity(town), town).toBe(false)
  })

  it('lists German cities above 100,000 and their English names, ignoring case', () => {
    for (const city of ['München', 'Munich', 'köln', 'Kaiserslautern', 'Frankfurt am Main']) expect(isLargeCity(city), city).toBe(true)
    for (const town of ['Passau', 'Bamberg']) expect(isLargeCity(town), town).toBe(false)
  })
})

describe('findIndirect', () => {
  it('finds several kinds in one text, without overlaps, in order', () => {
    const text = 'Ich bin eine 42-jährige Steuerberaterin in Wels und die einzige Frau im Team.'
    expect(warnings(text, 'Wels')).toEqual(['age:42-jährige', 'role-place:Steuerberaterin@Wels', 'only:einzige Frau'])
  })

  it('finds nothing in plain feedback', () => {
    expect(warnings('Der Export als CSV dauert zu lange, bitte beheben.')).toEqual([])
  })
})
