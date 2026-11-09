// Check digit rules for the identifiers Painfold detects. A detector only
// reports a candidate whose check digits are right, which keeps order numbers
// and other look-alikes out.

/** IBAN length per country (ISO 13616), for the countries most common in DACH feedback and their neighbours. */
export const IBAN_LENGTHS: Record<string, number> = {
  AT: 20, BE: 16, CH: 21, CZ: 24, DE: 22, DK: 18, ES: 24, FI: 18, FR: 27, GB: 22, HR: 21, HU: 28,
  IE: 22, IT: 27, LI: 21, LU: 20, NL: 18, NO: 15, PL: 28, PT: 25, SE: 24, SI: 19, SK: 24,
}

/** ISO 7064 mod 97-10 on a compact IBAN. */
export function isValidIban(compact: string): boolean {
  const iban = compact.toUpperCase()
  if (IBAN_LENGTHS[iban.slice(0, 2)] !== iban.length || !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false
  let remainder = 0
  for (const char of iban.slice(4) + iban.slice(0, 4)) {
    const value = char >= 'A' ? String(char.charCodeAt(0) - 55) : char
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

/** Luhn (mod 10) check used by payment card numbers. */
export function passesLuhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2
    sum += digit
  }
  return digits.length > 0 && sum % 10 === 0
}

/** Card networks by number prefix and the lengths they issue. */
const CARD_NETWORKS: { prefix: RegExp, lengths: number[] }[] = [
  { prefix: /^4/, lengths: [13, 16, 19] }, // Visa
  { prefix: /^(?:5[1-5]|2(?:2[2-9]|[3-6]\d|7[01]|720))/, lengths: [16] }, // Mastercard
  { prefix: /^3[47]/, lengths: [15] }, // American Express
  { prefix: /^(?:6011|65|64[4-9])/, lengths: [16, 19] }, // Discover
  { prefix: /^35(?:2[89]|[3-8])/, lengths: [16, 19] }, // JCB
  { prefix: /^3(?:0[0-5]|[68])/, lengths: [14, 16, 19] }, // Diners Club
  { prefix: /^(?:5018|5020|5038|56|57|58|6304|67)/, lengths: [12, 13, 14, 15, 16, 17, 18, 19] }, // Maestro
]

export function isValidCardNumber(digits: string): boolean {
  return CARD_NETWORKS.some(network => network.prefix.test(digits) && network.lengths.includes(digits.length)) && passesLuhn(digits)
}

// Weights for digits 1-3 and 5-10; digit 4 is the check digit.
const SVNR_WEIGHTS = [3, 7, 9, 0, 5, 8, 4, 2, 1, 6]

/**
 * Austrian social insurance number (Versicherungsnummer, SV-Nummer): a 3-digit
 * serial that never starts with 0, a check digit, then six digits that are
 * usually, but not always, the birth date DDMMYY. The check digit is the
 * weighted sum mod 11; numbers whose remainder is 10 are never issued.
 *
 * The last six digits are deliberately not checked as a date: when the numbers
 * for a date run out, "artificial birth dates" such as 1.13. or 1.14. are
 * issued, and the official description lists no complete set of values. Every
 * officially valid number is detected, at the cost of some look-alikes.
 * Source: Dachverband der Sozialversicherungsträger, "Was ist die
 * Versicherungsnummer?", https://www.sozialversicherung.at/cdscontent/?contentid=10007.820902
 */
export function isValidSvnr(digits: string): boolean {
  if (!/^[1-9]\d{9}$/.test(digits)) return false
  const check = SVNR_WEIGHTS.reduce((sum, weight, i) => sum + weight * Number(digits[i]), 0) % 11
  return check !== 10 && check === Number(digits[3])
}

const digitSum = (n: number) => Math.floor(n / 10) + (n % 10)

/** Austrian UID: ATU + 7 digits + check digit. */
export function isValidAustrianUid(uid: string): boolean {
  const match = /^ATU(\d{7})(\d)$/.exec(uid)
  if (!match) return false
  const sum = [...match[1]!].reduce((total, d, i) => total + (i % 2 === 1 ? digitSum(2 * Number(d)) : Number(d)), 0)
  return (10 - ((sum + 4) % 10)) % 10 === Number(match[2])
}

/** German USt-IdNr.: DE + 8 digits + ISO 7064 mod 11,10 check digit. */
export function isValidGermanVatId(vat: string): boolean {
  const match = /^DE([1-9]\d{7})(\d)$/.exec(vat)
  if (!match) return false
  let product = 10
  for (const d of match[1]!) {
    const sum = (Number(d) + product) % 10 || 10
    product = (2 * sum) % 11
  }
  const check = 11 - product
  return (check === 10 ? 0 : check) === Number(match[2])
}
