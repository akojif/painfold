import { describe, expect, it } from 'vitest'
import { detect } from '../../core/detect'
import { cardDetector } from '../../core/detect/card'
import { isValidAustrianUid, isValidCardNumber, isValidGermanVatId, isValidIban, isValidSvnr } from '../../core/detect/checksums'
import { ibanDetector } from '../../core/detect/iban'
import { svnrDetector } from '../../core/detect/svnr'
import type { Detector } from '../../core/detect/types'
import { vatDetector } from '../../core/detect/vat'
import { normalizeValue } from '../../core/redact/placeholders'
import { seededRandom } from '../../scripts/fake-data/random'
import * as generated from '../../scripts/fake-data/values'

const values = (detector: Detector, text: string) => detector.detect(text).map(found => found.value)

describe('IBAN', () => {
  it.each([
    ['Neue Bankverbindung: AT61 1904 3002 3457 3201.', 'AT61 1904 3002 3457 3201'],
    ['IBAN DE89370400440532013000 (ohne Leerzeichen)', 'DE89370400440532013000'],
    ['Refund to de89 3704 0044 0532 0130 00 please', 'de89 3704 0044 0532 0130 00'],
    ['IBAN: CH93 0076 2011 6238 5295 7, danke', 'CH93 0076 2011 6238 5295 7'],
    ['Konto AT61 1904 3002 3457 3201 bitte belasten', 'AT61 1904 3002 3457 3201'],
    ['(GB29 NWBK 6016 1331 9268 19)', 'GB29 NWBK 6016 1331 9268 19'],
  ])('finds the IBAN in %j', (text, expected) => {
    expect(values(ibanDetector, text)).toEqual([expected])
  })

  it.each([
    'Bitte nicht auf AT61 1904 3002 3457 3202 überweisen.',
    'Version DE89 ist veraltet.',
    'AT61 1904 3002 3457 32019 has a digit too many',
    'Order XX12 3456 7890 1234 5678',
  ])('finds nothing in %j', (text) => {
    expect(ibanDetector.detect(text)).toEqual([])
  })
})

describe('card numbers', () => {
  it.each([
    ['Card 4111-1111-1111-1111 expired', '4111-1111-1111-1111'],
    ['Amex 3782 822463 10005 wurde abgelehnt', '3782 822463 10005'],
    ['Karte 5555555555554444, bitte', '5555555555554444'],
    ['Mastercard 5105 1051 0510 5100.', '5105 1051 0510 5100'],
  ])('finds the card number in %j', (text, expected) => {
    expect(values(cardDetector, text)).toEqual([expected])
  })

  it.each([
    'The number 4111 1111 1111 1112 is not a card.',
    'Ticket 1234567890123456 was closed.',
    'Mixed 4111-1111 1111-1111 separators',
    'Order 4711-0815-2231 is open',
    'Tracking 1Z 999 AA1 01 2345 6784',
    'Batch 41111111111111110000 is longer than any card',
  ])('finds nothing in %j', (text) => {
    expect(cardDetector.detect(text)).toEqual([])
  })
})

describe('Austrian social insurance number (SV-Nummer)', () => {
  it.each([
    ['Meine Sozialversicherungsnummer ist 1237 010180.', '1237 010180'],
    ['SV-Nr. 1237010180 für die Lohnverrechnung', '1237010180'],
  ])('finds the number in %j', (text, expected) => {
    expect(values(svnrDetector, text)).toEqual([expected])
  })

  it.each([
    'Die Kundennummer 1238 010180 hat nichts damit zu tun.',
    'Invoice 0237 010180 starts with zero',
    'Amount 1.237.010.180 is not a number like that',
    'Phone 06641 234567',
  ])('finds nothing in %j', (text) => {
    expect(svnrDetector.detect(text)).toEqual([])
  })
})

describe('SV-Nummer: order and invoice numbers that pass the check digit', () => {
  // Each of these passes the SV-Nummer check digit; the word before it says it is not one.
  it.each([
    'Rechnung 4711190056 ist doppelt abgebucht.',
    'Rechnungsnummer: 4711229651',
    'Bestellung 4711253408 kam nicht an.',
    'Bestell-Nr. 4711451383',
    'Auftrag 4711514735 vom März',
    'Kunden-Nr. 4711546411',
    'Kundennummer 4711190056 bitte angeben',
    'Order 4711229651 was shipped twice.',
    'Invoice no. 4711253408 is wrong.',
    'Ticket #4711451383 is still open.',
  ])('finds nothing in %j', (text) => {
    expect(svnrDetector.detect(text)).toEqual([])
  })

  it('still finds the same digits with SV context, or with no context at all', () => {
    expect(values(svnrDetector, 'SV-Nr. 4711190056')).toEqual(['4711190056'])
    expect(values(svnrDetector, 'Versicherungsnummer 4711 190056, danke')).toEqual(['4711 190056'])
    expect(values(svnrDetector, 'Bitte 4711190056 eintragen.')).toEqual(['4711190056'])
  })
})

describe('SV-Nummer: every officially valid number', () => {
  // Builds a number with a correct check digit for a serial and a date part,
  // moving to the next serial when the remainder is 10 (never issued).
  function svnr(datePart: string, serial = 123): string {
    const weights = [3, 7, 9, 5, 8, 4, 2, 1, 6]
    for (let s = serial; ; s++) {
      const digits = `${s}${datePart}`
      const check = [...digits].reduce((sum, d, i) => sum + weights[i]! * Number(d), 0) % 11
      if (check !== 10) return `${s}${check}${datePart}`
    }
  }

  it('matches the official example 7829 280755', () => {
    expect(isValidSvnr('7829280755')).toBe(true)
  })

  it.each([
    ['an artificial birth date in month 13 (official example 5.13.1947)', '051347'],
    ['month 14', '011450'],
    ['month 15', '011560'],
    ['a higher month ("usw.")', '012070'],
    ['day 00', '000180'],
    ['month 00', '150080'],
    ['day 32', '320180'],
  ])('accepts %s, since the date part is not always a real date', (_, datePart) => {
    const number = svnr(datePart)
    expect(isValidSvnr(number), number).toBe(true)
    expect(values(svnrDetector, `SV-Nr. ${number.slice(0, 4)} ${number.slice(4)}`)).toEqual([`${number.slice(0, 4)} ${number.slice(4)}`])
  })

  it('never accepts a number whose check computation leaves remainder 10', () => {
    const weights = [3, 7, 9, 5, 8, 4, 2, 1, 6]
    for (let serial = 100; serial < 200; serial++) {
      const digits = `${serial}010180`
      if ([...digits].reduce((sum, d, i) => sum + weights[i]! * Number(d), 0) % 11 !== 10) continue
      for (let check = 0; check <= 9; check++) expect(isValidSvnr(`${serial}${check}010180`)).toBe(false)
    }
  })
})

describe('VAT IDs (UID, USt-IdNr.)', () => {
  it.each([
    ['UID ATU13585627 fehlt auf der Rechnung.', 'ATU13585627'],
    ['UID: ATU 13585627', 'ATU 13585627'],
    ['USt-IdNr. DE136695976, bitte übernehmen.', 'DE136695976'],
  ])('finds the ID in %j', (text, expected) => {
    expect(values(vatDetector, text)).toEqual([expected])
  })

  it.each([
    'ATU13585628 was rejected by the VIES check.',
    'DE136695977 has a wrong check digit.',
    'DE12345678 is too short',
    'NATU13585627 is part of another word',
  ])('finds nothing in %j', (text) => {
    expect(vatDetector.detect(text)).toEqual([])
  })
})

describe('validators', () => {
  it('match the published reference values', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true)
    expect(isValidIban('AT611904300234573201')).toBe(true)
    expect(isValidIban('AT611904300234573202')).toBe(false)
    expect(isValidCardNumber('4111111111111111')).toBe(true)
    expect(isValidCardNumber('378282246310005')).toBe(true)
    expect(isValidCardNumber('4111111111111112')).toBe(false)
    expect(isValidSvnr('1237010180')).toBe(true)
    expect(isValidSvnr('1238010180')).toBe(false)
    expect(isValidAustrianUid('ATU13585627')).toBe(true)
    expect(isValidGermanVatId('DE136695976')).toBe(true)
  })

  it('agree with the independent validators of the fake data generator on 3,000 values', () => {
    const random = seededRandom(7)
    for (let i = 0; i < 500; i++) {
      for (const iban of [generated.iban(random), generated.invalidIban(random)]) {
        expect(isValidIban(iban.replace(/\s/g, '')), iban).toBe(generated.isValidIban(iban))
      }
      const svnr = generated.svnr(random).replace(/\s/g, '')
      expect(isValidSvnr(svnr), svnr).toBe(true)
      const vat = generated.vatId(random)
      expect(vat.startsWith('ATU') ? isValidAustrianUid(vat) : isValidGermanVatId(vat), vat).toBe(true)
      for (const card of [generated.card(random), generated.invalidCard(random)]) {
        expect(isValidCardNumber(card.replace(/\D/g, '')), card).toBe(generated.isValidLuhn(card))
      }
    }
  })
})

describe('placeholders for identifiers', () => {
  it('give the same value the same placeholder however it is spaced or cased', () => {
    expect(normalizeValue('IBAN', 'de89 3704 0044 0532 0130 00')).toBe(normalizeValue('IBAN', 'DE89370400440532013000'))
    expect(normalizeValue('CARD', '4111-1111-1111-1111')).toBe(normalizeValue('CARD', '4111 1111 1111 1111'))
    expect(normalizeValue('VAT_ID', 'ATU 13585627')).toBe(normalizeValue('VAT_ID', 'ATU13585627'))
  })
})

describe('all detectors together', () => {
  it('keep an IBAN whole rather than finding a card or SV-Nummer inside it', () => {
    expect(detect('IBAN AT61 1904 3002 3457 3201 und Karte 4111 1111 1111 1111').map(found => found.type)).toEqual(['IBAN', 'CARD'])
  })

  it('stay fast on long digit and letter runs', () => {
    for (const input of ['1 '.repeat(40_000), 'AT61 '.repeat(20_000), `${'4'.repeat(50_000)}`, `ATU${'1'.repeat(50_000)}`]) {
      const started = performance.now()
      detect(input)
      expect(performance.now() - started, input.slice(0, 12)).toBeLessThan(1000)
    }
  })
})
