import { describe, expect, it } from 'vitest'
import { detect } from '../../core/detect'
import { addressDetector, postcodeDetector } from '../../core/detect/address'
import { dateOfBirthDetector } from '../../core/detect/date-of-birth'
import { phoneDetector } from '../../core/detect/phone'
import type { Detector } from '../../core/detect/types'
import { normalizeValue } from '../../core/redact/placeholders'

const values = (detector: Detector, text: string) => detector.detect(text).map(found => found.value)

describe('phone numbers', () => {
  it.each([
    ['Erreichbar unter +43 (0)664 123 45 67 ab 9 Uhr.', '+43 (0)664 123 45 67'],
    ['Handy: 0664/1234567', '0664/1234567'],
    ['Tel.: 01 234 56 78 (Wien)', '01 234 56 78'],
    ['Bitte unter +49 (0)30 23125-417 anrufen', '+49 (0)30 23125-417'],
    ['Festnetz 030 / 23125 417', '030 / 23125 417'],
    ['Ruf mich an: (030) 23125417', '(030) 23125417'],
    ['call me on 07700 900 123 please', '07700 900 123'],
    ['UK office +44 20 7946 0958', '+44 20 7946 0958'],
    ['Mobil 0043-664-1234567', '0043-664-1234567'],
    ['Tel. 0316 123456 Durchwahl 12', '0316 123456'],
    ['meine Nummer ist 0676 1234567, danke', '0676 1234567'],
    ['phone: +49 151 23456789', '+49 151 23456789'],
    ['Rückruf bitte auf 06991234567', '06991234567'],
    ['WhatsApp +43664 1234567', '+43664 1234567'],
    ['Kontakt 0049 30 23125 418 oder Mail', '0049 30 23125 418'],
    ['text me at +44 7700 900461', '+44 7700 900461'],
    ['Tel 02236 12345', '02236 12345'],
    ['Hotline 0800 123 456', '0800 123 456'],
    ['Bitte rufen Sie mich unter 030 23125417 zurück.', '030 23125417'],
    ['Number for the callback: 2345 6789 (office)', '2345 6789'],
    ['0664 1234567', '0664 1234567'],
    ['Tel.-Nr. 0664 1234567', '0664 1234567'],
    ['Telefon-Nr.: 030 23125417', '030 23125417'],
    ['Handy-Nr 0676 1234567', '0676 1234567'],
    ['Mobil-Nr.: +43 676 1234567', '+43 676 1234567'],
  ])('finds the phone number in %j', (text, expected) => {
    expect(values(phoneDetector, text)).toEqual([expected])
  })

  it.each([
    'Bestellnummer 4711-0815-2231 ist immer noch offen.',
    'Rechnung RE-2026-000417 über € 1.299,00 wurde am 12.03.2026 bezahlt.',
    'Our order 20 553 1820 shipped on 3 March, tracking 1Z 999 AA1 01 2345 6784.',
    'Wir haben 2023 bis 2026 rund 14000 Rechnungen erstellt.',
    'Opening hours are 08:30 to 17:00, Monday to Friday.',
    'Bestellung B-18244223 wurde doppelt abgebucht.',
    'Ticket #48213 is still open.',
    'Kundennummer 0123456789 bitte angeben.',
    'Invoice 2026-03-1234 is missing.',
    'Neue Adresse: Mariahilfer Straße 45/3, 1060 Wien.',
    'Version 2.14.3 crashes, build 20260312.',
    'Die Summe beträgt 1 234 567 Euro.',
    'Zeitraum 01.01.2025 - 31.12.2025',
    'Auftrag 30012345 vom 4. März',
    'PLZ 80331 München',
    'Seriennummer 0664 1234 5678 9012',
    'Server 192.0.2.17 antwortet nicht',
    'Bestell-Nr. 0664 1234567',
    'Kunden-Nr. 030 23125417',
    'Rechnungsnummer: 0316 123456',
    'Nr. 0123 456789 im Lager',
  ])('finds nothing in %j', (text) => {
    expect(phoneDetector.detect(text)).toEqual([])
  })

  it('gives the same number the same placeholder in national and international spellings', () => {
    expect(normalizeValue('PHONE', '+43 (0)664 123 45 67')).toBe(normalizeValue('PHONE', '0043 664 1234567'))
    expect(normalizeValue('PHONE', '+43664 1234567')).toBe('+436641234567')
  })
})

describe('dates of birth', () => {
  it.each([
    ['geboren am 12.03.1987', '12.03.1987'],
    ['Ich (geb. 14.2.1979) bin seit 2019 Kunde.', '14.2.1979'],
    ['Geburtsdatum: 03.07.1988, Eintritt am 01.09.2024.', '03.07.1988'],
    ['Geburtstag 1. Jänner 1990', '1. Jänner 1990'],
    ['geboren am 12. März 1987 in Graz', '12. März 1987'],
    ['date of birth 03/07/1988', '03/07/1988'],
    ['DOB: 1985-07-21', '1985-07-21'],
    ['Born 21 July 1985, member since March 2020.', '21 July 1985'],
    ['born on March 21, 1985', 'March 21, 1985'],
    ['Geb.-Datum 5.6.62', '5.6.62'],
  ])('finds the birth date in %j', (text, expected) => {
    expect(values(dateOfBirthDetector, text)).toEqual([expected])
  })

  it.each([
    'The invoice dated 21/07/2025 is missing from the export.',
    'Kündigung zum 31.12.2026, Vertrag seit 01.01.2021.',
    'Rechnung vom 12.03.2024 fehlt',
    'Das Problem tritt seit 1.2.2026 auf.',
    'geboren am 31.02.1980 is not a date',
    'born in Graz, moved here in 2020',
  ])('finds nothing in %j', (text) => {
    expect(dateOfBirthDetector.detect(text)).toEqual([])
  })
})

describe('street addresses', () => {
  it.each([
    ['Neue Adresse: Mariahilfer Straße 45/3, 1060 Wien.', 'Mariahilfer Straße 45/3'],
    ['Bitte an Hauptstraße 12/3/7 liefern', 'Hauptstraße 12/3/7'],
    ['Wohnhaft Lindengasse 5, Stiege 2, Top 5', 'Lindengasse 5, Stiege 2, Top 5'],
    ['Am Steinfeld 14, 4600 Wels', 'Am Steinfeld 14'],
    ['Ahornweg 7a in Linz', 'Ahornweg 7a'],
    ['Lieferung an Hauptplatz 7 in 4020 Linz.', 'Hauptplatz 7'],
    ['Birkenallee 12-14, 80331 München', 'Birkenallee 12-14'],
    ['Rosenhügelstraße 3/Top 5', 'Rosenhügelstraße 3/Top 5'],
    ['Wiedner Gürtel 18', 'Wiedner Gürtel 18'],
    ['Ship to 27 Willow Lane, Bristol BS1 4DJ.', '27 Willow Lane'],
    ['Office at 12 Baker Street', '12 Baker Street'],
  ])('finds the address in %j', (text, expected) => {
    expect(values(addressDetector, text)).toEqual([expected])
  })

  it.each([
    'Wir haben 1070 Rechnungen im Jahr.',
    'The street outside is noisy.',
    'Seite 12 der Anleitung',
    'Version 3 vom Weg zur Lösung',
  ])('finds nothing in %j', (text) => {
    expect(addressDetector.detect(text)).toEqual([])
  })
})

describe('postcodes', () => {
  it.each([
    ['Mariahilfer Straße 45/3, 1060 Wien', ['1060']],
    ['Lieferung an Hauptplatz 7 in 4020 Linz.', ['4020']],
    ['PLZ 80331 München', ['80331']],
    ['Adresse: A-6020 Innsbruck', ['6020']],
    ['Bristol BS1 4DJ', ['BS1 4DJ']],
    ['Ich wohne in 5020 Salzburg', ['5020']],
  ])('finds the postcode in %j', (text, expected) => {
    expect(values(postcodeDetector, text)).toEqual(expected)
  })

  it.each([
    'Wir haben 1070 Rechnungen im Jahr und 4020 Buchungszeilen.',
    'Im Jahr 2026 Kunden gewonnen',
    'Bestellung 12345 Stück',
  ])('finds nothing in %j', (text) => {
    expect(postcodeDetector.detect(text)).toEqual([])
  })
})

describe('all detectors together', () => {
  it('read an SV-Nummer, an IP address and a birth date as such, not as phone numbers', () => {
    const found = detect('SV-Nr. 1237 010180, Server 192.0.2.17, geboren am 12.03.1987, Tel. 0664 1234567')
    expect(found.map(({ type, value }) => [type, value])).toEqual([
      ['SVNR', '1237 010180'],
      ['IP', '192.0.2.17'],
      ['DATE_OF_BIRTH', '12.03.1987'],
      ['PHONE', '0664 1234567'],
    ])
  })

  it('find a full Austrian address as street and postcode', () => {
    const found = detect('Lieferadresse: Waldrandweg 100/2/14, 6020 Innsbruck')
    expect(found.map(({ type, value }) => [type, value])).toEqual([['ADDRESS', 'Waldrandweg 100/2/14'], ['POSTCODE', '6020']])
  })

  it('stay fast on long inputs', () => {
    for (const input of ['0'.repeat(50_000), '1 2 '.repeat(20_000), 'Hauptstraße '.repeat(5_000), 'geb. '.repeat(10_000), `${'A'.repeat(20_000)}weg 1`]) {
      const started = performance.now()
      detect(input)
      expect(performance.now() - started, input.slice(0, 12)).toBeLessThan(1500)
    }
  })
})
