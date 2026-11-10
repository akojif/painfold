import { describe, expect, it } from 'vitest'
import { isFirstName, nameKey } from '../../core/detect/first-names'
import { cueNames, withNameRules } from '../../core/detect/name-cues'
import type { Detection } from '../../core/detect/types'

const names = (text: string) => cueNames(text).map(found => found.value)
const model = (text: string, ...spans: Array<[Detection['type'], string]>): Detection[] => spans.map(([type, value]) => {
  const start = text.indexOf(value)
  return { type, start, end: start + value.length, value }
})
const combined = (text: string, ...spans: Array<[Detection['type'], string]>) => withNameRules(text, model(text, ...spans)).map(found => `${found.type}:${found.value}`)

describe('names after cues', () => {
  it('finds names after greetings, titles, thanks, sign-offs and introductions', () => {
    expect(names('Hallo Anna, das Login geht nicht.')).toEqual(['Anna'])
    expect(names('Sehr geehrte Frau Novak, danke.')).toEqual(['Novak'])
    expect(names('Thanks to Olivia Brennan for the quick fix.')).toEqual(['Olivia Brennan'])
    expect(names('LG Markus')).toEqual(['Markus'])
    expect(names('Viele Grüße\nSophie Grünwald')).toEqual(['Sophie Grünwald'])
    expect(names('Best regards,\nAmir Hadžić')).toEqual(['Amir Hadžić'])
    expect(names('Hi, my name is Daniel Brennan and I need help.')).toEqual(['Daniel Brennan'])
  })

  it('keeps particles and hyphens inside a name', () => {
    expect(names('Cheers, Jan van der Meer')).toEqual(['Jan van der Meer'])
    expect(names('Danke, Fatima Al-Masri')).toEqual(['Fatima Al-Masri'])
    expect(names('Signed: Eleanor St. Clair')).toEqual(['Eleanor St. Clair'])
  })

  it('finds a known first name in lowercase, but no other lowercase word', () => {
    expect(names('hi anna, quick question')).toEqual(['anna'])
    expect(names('thx mehmet')).toEqual(['mehmet'])
    expect(names('hi, ich habe eine Frage')).toEqual([])
    expect(names('hi can you help me')).toEqual([])
    expect(names('thanks will do')).toEqual([])
  })

  it('stops at words that follow cues but are not names', () => {
    for (const text of [
      'Hallo Team, der Export hängt.',
      'Hallo zusammen!',
      'Hallo liebes Support-Team',
      'Dear Customer Support',
      'Dear Sir or Madam',
      'Sehr geehrte Damen und Herren',
      'Liebe Grüße und danke!',
      'Danke Ihnen für die Hilfe.',
      'Danke im Voraus',
      'Grüße aus Wien',
      'Hi all, hi everyone, hi there',
      'Best regards,\nThe Accounting Team',
      'Thanks for the quick reply.',
    ]) expect(names(text), text).toEqual([])
  })

  it('does not take German nouns for names', () => {
    expect(names('Ich bin Lehrerin und nutze die App täglich.')).toEqual([])
    expect(names('Nach 500 ms Verzögerung lädt die Seite.')).toEqual([])
    expect(names('This is the best Tool we have.')).toEqual([])
    expect(names('Ich bin Anna und nutze die App täglich.')).toEqual(['Anna'])
  })
})

describe('the model and the cue rules together', () => {
  it('drops a model detection that is only a word like Madam or Team', () => {
    expect(combined('Dear Sir or Madam, I would like a refund.', ['NAME', 'Madam'])).toEqual([])
  })

  it('labels a name after a cue as a name, even where the model said place', () => {
    expect(combined('Cheers, Jędrzej Mazur', ['PLACE', 'Jędrzej Mazur'])).toEqual(['NAME:Jędrzej Mazur'])
    expect(combined('Viele Grüße\nSophie Grünwald', ['PLACE', 'Grünwald'])).toEqual(['NAME:Sophie Grünwald'])
  })

  it('adds a surname the model left out, but not a word it labelled itself', () => {
    expect(combined('Das hat Mursal Sadat gemeldet.', ['NAME', 'Mursal'])).toEqual(['NAME:Mursal Sadat'])
    expect(combined('Anna Wien', ['NAME', 'Anna'], ['PLACE', 'Wien'])).toEqual(['NAME:Anna', 'PLACE:Wien'])
    expect(combined('Anna Team', ['NAME', 'Anna'])).toEqual(['NAME:Anna'])
  })

  it('keeps model names and places without a cue as they are', () => {
    expect(combined('Ahmad aus Linz hat angerufen.', ['NAME', 'Ahmad'], ['PLACE', 'Linz'])).toEqual(['NAME:Ahmad', 'PLACE:Linz'])
  })
})

describe('the first-name list', () => {
  it('ignores case and accents', () => {
    expect(nameKey('Ayşegül')).toBe(nameKey('aysegul'))
    expect(isFirstName('Łukasz')).toBe(true)
    expect(isFirstName('lukasz', { lowercase: true })).toBe(true)
  })

  it('does not count first names that are everyday words in lowercase', () => {
    expect(isFirstName('Can')).toBe(true)
    expect(isFirstName('can', { lowercase: true })).toBe(false)
  })
})
