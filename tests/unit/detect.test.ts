import { describe, expect, it } from 'vitest'
import { detect, DETECTED_TYPES } from '../../core/detect'
import { emailDetector } from '../../core/detect/email'
import { ipDetector } from '../../core/detect/ip'
import { urlDetector } from '../../core/detect/url'
import type { Detector } from '../../core/detect/types'

const values = (detector: Detector, text: string) => detector.detect(text).map(found => found.value)

describe('emailDetector', () => {
  it.each([
    ['Schreiben Sie an anna.feldmoser@example.com.', 'anna.feldmoser@example.com'],
    ['Reach me at <j.dunmore@mail.example.com>, thanks', 'j.dunmore@mail.example.com'],
    ['Kontakt: Sabine.Weidenauer@Example.org; danke', 'Sabine.Weidenauer@Example.org'],
    ['felix+rechnungen@example.net bitte verwenden', 'felix+rechnungen@example.net'],
    ['Mail an jürgen@müller-beispiel.example', 'jürgen@müller-beispiel.example'],
    ['(o\'brien@example.com)', 'o\'brien@example.com'],
  ])('finds the address in %j', (text, expected) => {
    expect(values(emailDetector, text)).toEqual([expected])
  })

  it.each([
    ['olivia (at) example (dot) net', 'olivia (at) example (dot) net'],
    ['anna [ät] beispiel [punkt] at', 'anna [ät] beispiel [punkt] at'],
  ])('finds the obfuscated address in %j', (text, expected) => {
    expect(values(emailDetector, text)).toEqual([expected])
  })

  it.each([
    'bitte nicht an info@ schreiben',
    'The @mention feature does not notify @team members.',
    'Preis: 5 @ 12,00 €',
    'Version 2.0@beta',
    'we meet at (at) noon',
  ])('finds nothing in %j', (text) => {
    expect(emailDetector.detect(text)).toEqual([])
  })
})

describe('urlDetector', () => {
  it.each([
    ['My invoice link: https://example.com/i/88213?token=ab12cd.', 'https://example.com/i/88213?token=ab12cd'],
    ['Siehe www.example.org/rechnung/88213, da ist der Fehler.', 'www.example.org/rechnung/88213'],
    ['(see https://example.com/a)', 'https://example.com/a'],
    ['https://en.example.org/wiki/Thing_(disambiguation) is the page', 'https://en.example.org/wiki/Thing_(disambiguation)'],
    ['Link: HTTP://EXAMPLE.COM/U/1!', 'HTTP://EXAMPLE.COM/U/1'],
  ])('finds the link in %j', (text, expected) => {
    expect(values(urlDetector, text)).toEqual([expected])
  })

  it.each([
    'Wir nutzen example.com als Testdomain.',
    'Die Datei heißt rechnung.pdf',
    'Visit https:// later',
    'www.',
  ])('finds nothing in %j', (text) => {
    expect(urlDetector.detect(text)).toEqual([])
  })
})

describe('ipDetector', () => {
  it.each([
    ['Our office IP is 203.0.113.42 if you need it.', '203.0.113.42'],
    ['Two logins from 198.51.100.7 were not me', '198.51.100.7'],
    ['Login-Versuche von 192.0.2.1 und 192.0.2.254!', '192.0.2.1'],
    ['Connection from 2001:db8::8a2e:370:7334 was blocked.', '2001:db8::8a2e:370:7334'],
    ['IPv6 2001:0db8:0000:0000:0000:ff00:0042:8329 full', '2001:0db8:0000:0000:0000:ff00:0042:8329'],
  ])('finds the address in %j', (text, expected) => {
    expect(values(ipDetector, text)[0]).toBe(expected)
  })

  it.each([
    'Version 2.14.3.1 crashes on start.',
    'Seit dem Update auf 3.12.0.4 geht nichts mehr.',
    'after the 4.2.1.7 update the export broke',
    'Das Problem tritt seit 1.2.2026 auf, Version 4.0.1.',
    'Rechnung vom 12.03.2024',
    '999.1.1.1 is not an address',
    '1.2.3.4.5 has five parts',
    'Opening hours are 08:30 to 17:00:00.',
    'MAC 00:1A:2B:3C:4D:5E',
  ])('finds nothing in %j', (text) => {
    expect(ipDetector.detect(text)).toEqual([])
  })
})

describe('DETECTED_TYPES', () => {
  it('lists the type of every detector, once', () => {
    expect(DETECTED_TYPES).toEqual(['EMAIL', 'URL', 'IP'])
  })
})

describe('detect', () => {
  it('returns detections from all detectors, sorted by position', () => {
    const found = detect('Mail a@example.com from 192.0.2.5, see www.example.org/x')
    expect(found.map(({ type, value }) => [type, value])).toEqual([
      ['EMAIL', 'a@example.com'],
      ['IP', '192.0.2.5'],
      ['URL', 'www.example.org/x'],
    ])
  })

  it('removes an email inside a link together with the link', () => {
    const found = detect('Open https://example.com/unsubscribe?email=anna@example.com now')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ type: 'URL', value: 'https://example.com/unsubscribe?email=anna@example.com' })
  })

  it('finds nothing in ordinary feedback', () => {
    expect(detect('Der PDF-Export dauert seit dem Update ewig. 40 Rechnungen, € 1.299,00.')).toEqual([])
  })

  it('stays fast on long adversarial input', () => {
    const inputs = [
      'a'.repeat(50_000) + '@',
      `${'a-'.repeat(25_000)}@example`,
      `x@${'a.'.repeat(25_000)}`,
      `https://${'('.repeat(20_000)}`,
      '1.'.repeat(30_000),
      ':'.repeat(50_000),
      'a (at) '.repeat(10_000),
    ]
    for (const input of inputs) {
      const started = performance.now()
      detect(input)
      expect(performance.now() - started, input.slice(0, 20)).toBeLessThan(500)
    }
  })
})
