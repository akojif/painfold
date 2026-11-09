// Fake values for test data. Nothing here is taken from a real person:
// - emails, URLs and hosts use the reserved example.com/.org/.net domains (RFC 2606)
// - IP addresses come from the documentation ranges (RFC 5737, RFC 3849)
// - German landlines use the Bundesnetzagentur drama-number block 030 23125 000-999,
//   UK numbers the Ofcom drama ranges; Austrian numbers are random (no official range)
// - IBANs, SV-Nummern and VAT IDs are random with valid check digits
// - card numbers are the payment networks' published test numbers
import { mark } from './markup.ts'
import type { Random } from './random.ts'

export type Lang = 'de' | 'en'
export type Person = { first: string, last: string }

const FIRST_NAMES = {
  de: ['Anna', 'Lukas', 'Sophie', 'Maximilian', 'Lena', 'Jonas', 'Marie', 'Felix', 'Hannah', 'Tobias', 'Julia', 'Elias', 'Katharina', 'Florian', 'Theresa', 'Stefan', 'Jürgen', 'Sabine', 'Matthias', 'Elisabeth'],
  en: ['Emily', 'James', 'Olivia', 'Daniel', 'Grace', 'Thomas', 'Chloe', 'Samuel', 'Megan', 'Oliver', 'Hannah', 'George', 'Lucy', 'Henry', 'Amelia'],
}

// Invented surnames, chosen to sound plausible without belonging to anyone in particular.
const LAST_NAMES = {
  de: ['Brunnthaler', 'Feldmoser', 'Winterquell', 'Ahornegger', 'Kranzbichler', 'Steinwander', 'Mühlhofer', 'Lindgruber', 'Haselsteiner', 'Birkenreiter', 'Grubenhofer', 'Rosenpichler', 'Talbacher', 'Weidenauer', 'Ötzlinger'],
  en: ['Ashworth-Penn', 'Brindlecombe', 'Calloway-Hart', 'Dunmore', 'Fenwick-Lowe', 'Hollinsby', 'Merriweather-Stone', 'Pendleworth', 'Quillfeather', 'Thistlewood'],
}

const DOMAINS = ['example.com', 'example.org', 'example.net', 'mail.example.com']

export function person(random: Random, lang: Lang): Person {
  return { first: random.pick(FIRST_NAMES[lang]), last: random.pick(LAST_NAMES[lang]) }
}

const TRANSLITERATION: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue' }
const ascii = (text: string) => text.replace(/[äöüßÄÖÜ]/g, letter => TRANSLITERATION[letter]!).replace(/[^A-Za-z]/g, '')

export function email(random: Random, who: Person): string {
  const first = ascii(who.first).toLowerCase()
  const last = ascii(who.last).toLowerCase()
  const local = random.pick([
    `${first}.${last}`,
    `${first[0]}.${last}`,
    `${first}${last}`,
    `${first}_${last}${random.int(1, 99)}`,
    `${first}.${last}+support`,
  ])
  const address = `${local}@${random.pick(DOMAINS)}`
  return random.chance(0.1) ? address.replace(/^./, c => c.toUpperCase()) : address
}

// ---- Phone numbers ----

export function phone(random: Random, lang: Lang): string {
  if (lang === 'en') {
    const tail = random.digits(3)
    return random.pick([
      `07700 900${tail}`,
      `+44 7700 900${tail}`,
      `+44 (0)7700 900 ${tail}`,
      `020 7946 0${tail}`,
      `+44 20 7946 0${tail}`,
    ])
  }
  if (random.chance(0.5)) {
    const tail = random.digits(3)
    return random.pick([
      `030 23125${tail}`,
      `030/23125-${tail}`,
      `+49 30 23125 ${tail}`,
      `+49 (0)30 23125${tail}`,
      `0049 30 23125 ${tail}`,
    ])
  }
  const prefix = random.pick(['664', '650', '660', '676', '699'])
  const rest = random.digits(7)
  return random.pick([
    `+43 ${prefix} ${rest.slice(0, 3)} ${rest.slice(3)}`,
    `0${prefix} ${rest}`,
    `0${prefix}/${rest}`,
    `+43 (0) ${prefix} ${rest.slice(0, 3)} ${rest.slice(3, 5)} ${rest.slice(5)}`,
    `0043 ${prefix} ${rest}`,
  ])
}

// ---- IBAN (ISO 13616, mod-97) ----

function ibanCheckDigits(country: string, bban: string): string {
  const rearranged = `${bban}${country}00`.replace(/[A-Z]/g, letter => String(letter.charCodeAt(0) - 55))
  let remainder = 0
  for (const digit of rearranged) remainder = (remainder * 10 + Number(digit)) % 97
  return String(98 - remainder).padStart(2, '0')
}

export function isValidIban(value: string): boolean {
  const compact = value.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(compact)) return false
  return ibanCheckDigits(compact.slice(0, 2), compact.slice(4)) === compact.slice(2, 4)
}

const groupsOfFour = (text: string) => text.replace(/(.{4})/g, '$1 ').trim()

export function iban(random: Random): string {
  const country = random.pick(['AT', 'DE'])
  const bban = country === 'AT' ? random.digits(16) : random.digits(18)
  const compact = `${country}${ibanCheckDigits(country, bban)}${bban}`
  return random.chance(0.7) ? groupsOfFour(compact) : compact
}

/** A well-formed IBAN whose check digits are wrong. */
export function invalidIban(random: Random): string {
  const valid = iban(random).replace(/\s+/g, '')
  const check = Number(valid.slice(2, 4))
  const wrong = String(check === 2 ? 3 : check - 1).padStart(2, '0')
  return groupsOfFour(`${valid.slice(0, 2)}${wrong}${valid.slice(4)}`)
}

// ---- Payment cards (Luhn) ----

// Published test numbers from Visa, Mastercard and American Express.
const TEST_CARDS = ['4111111111111111', '4012888888881881', '5555555555554444', '5105105105105100', '378282246310005']

export function isValidLuhn(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '')
  if (!/^\d{12,19}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

function formatCard(digits: string, separator: string): string {
  if (digits.length === 15) return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10)].join(separator)
  return digits.replace(/(\d{4})(?=\d)/g, `$1${separator}`)
}

export function card(random: Random): string {
  return formatCard(random.pick(TEST_CARDS), random.pick([' ', '-', '']))
}

/** A 16-digit number that looks like a card but fails the Luhn check. */
export function invalidCard(random: Random): string {
  const valid = random.pick(TEST_CARDS.filter(number => number.length === 16))
  const last = Number(valid.at(-1))
  return formatCard(`${valid.slice(0, -1)}${(last + 1) % 10}`, ' ')
}

// ---- Austrian social security number (SV-Nummer) ----

const SVNR_WEIGHTS = [3, 7, 9, 0, 5, 8, 4, 2, 1, 6]

export function isValidSvnr(value: string): boolean {
  const digits = value.replace(/\s+/g, '')
  if (!/^[1-9]\d{9}$/.test(digits)) return false
  const sum = SVNR_WEIGHTS.reduce((total, weight, i) => total + weight * Number(digits[i]), 0)
  return sum % 11 === Number(digits[3]) && sum % 11 !== 10
}

export function svnr(random: Random): string {
  for (;;) {
    const serial = `${random.int(1, 9)}${random.digits(2)}`
    const day = String(random.int(1, 28)).padStart(2, '0')
    const month = String(random.int(1, 12)).padStart(2, '0')
    const year = String(random.int(50, 99)).padStart(2, '0')
    const birth = `${day}${month}${year}`
    const partial = `${serial}0${birth}`
    const check = SVNR_WEIGHTS.reduce((total, weight, i) => total + weight * Number(partial[i]), 0) % 11
    if (check === 10) continue
    return random.chance(0.6) ? `${serial}${check} ${birth}` : `${serial}${check}${birth}`
  }
}

// ---- VAT IDs: Austrian UID (ATU) and German USt-IdNr. ----

const digitSum = (n: number) => Math.floor(n / 10) + (n % 10)

function atuCheckDigit(seven: string): number {
  const sum = [...seven].reduce((total, d, i) => total + (i % 2 === 1 ? digitSum(2 * Number(d)) : Number(d)), 0)
  return (10 - ((sum + 4) % 10)) % 10
}

function deVatCheckDigit(eight: string): number {
  let product = 10
  for (const d of eight) {
    let sum = (Number(d) + product) % 10
    if (sum === 0) sum = 10
    product = (2 * sum) % 11
  }
  const check = 11 - product
  return check === 10 ? 0 : check
}

export function isValidVatId(value: string): boolean {
  const compact = value.replace(/\s+/g, '').toUpperCase()
  if (/^ATU\d{8}$/.test(compact)) return atuCheckDigit(compact.slice(3, 10)) === Number(compact[10])
  if (/^DE\d{9}$/.test(compact)) return deVatCheckDigit(compact.slice(2, 10)) === Number(compact[10])
  return false
}

export function vatId(random: Random): string {
  if (random.chance(0.6)) {
    const seven = random.digits(7)
    return `ATU${seven}${atuCheckDigit(seven)}`
  }
  const eight = `${random.int(1, 9)}${random.digits(7)}`
  return `DE${eight}${deVatCheckDigit(eight)}`
}

// ---- URLs and IP addresses ----

export function url(random: Random): string {
  const id = random.int(1000, 99999)
  return random.pick([
    `https://example.com/account/${id}`,
    `https://app.example.org/invoices/${id}?view=pdf`,
    `www.example.net/profile/${id}`,
    `http://example.com/u/${id}`,
  ])
}

export function ip(random: Random): string {
  if (random.chance(0.2)) return `2001:db8::${random.int(1, 0xFFFF).toString(16)}`
  return `${random.pick(['192.0.2', '198.51.100', '203.0.113'])}.${random.int(1, 254)}`
}

// ---- Dates of birth ----

const MONTHS = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

/** A phrase with the date of birth marked, e.g. "geboren am [[DATE_OF_BIRTH:12.03.1987]]". */
export function dateOfBirth(random: Random, lang: Lang): string {
  const day = random.int(1, 28)
  const month = random.int(1, 12)
  const year = random.int(1950, 2004)
  const dd = String(day).padStart(2, '0')
  const mm = String(month).padStart(2, '0')
  if (lang === 'de') {
    return random.pick([
      `geboren am ${mark('DATE_OF_BIRTH', `${dd}.${mm}.${year}`)}`,
      `geb. ${mark('DATE_OF_BIRTH', `${day}.${month}.${year}`)}`,
      `Geburtsdatum: ${mark('DATE_OF_BIRTH', `${dd}.${mm}.${year}`)}`,
      `geboren am ${mark('DATE_OF_BIRTH', `${day}. ${MONTHS.de[month - 1]} ${year}`)}`,
    ])
  }
  return random.pick([
    `date of birth ${mark('DATE_OF_BIRTH', `${dd}/${mm}/${year}`)}`,
    `DOB: ${mark('DATE_OF_BIRTH', `${year}-${mm}-${dd}`)}`,
    `born on ${mark('DATE_OF_BIRTH', `${day} ${MONTHS.en[month - 1]} ${year}`)}`,
  ])
}

// ---- Addresses ----

const STREETS = {
  de: ['Ahornweg', 'Lindengasse', 'Mühlbachstraße', 'Birkenallee', 'Am Steinfeld', 'Rosenhügelstraße', 'Talgasse', 'Waldrandweg'],
  en: ['Willow Lane', 'Quarry Road', 'Elmfield Close', 'Harbour Street', 'Mill Row'],
}

const AT_TOWNS = [['1070', 'Wien'], ['4020', 'Linz'], ['5020', 'Salzburg'], ['8010', 'Graz'], ['6020', 'Innsbruck'], ['4600', 'Wels']] as const
const DE_TOWNS = [['80331', 'München'], ['10115', 'Berlin'], ['50667', 'Köln'], ['20095', 'Hamburg']] as const
const UK_TOWNS = [['BS1 4DJ', 'Bristol'], ['LS1 5AB', 'Leeds'], ['M1 2WD', 'Manchester']] as const

/** A full address line with street, postcode and town marked. */
export function address(random: Random, lang: Lang): string {
  if (lang === 'en') {
    const [postcode, town] = random.pick(UK_TOWNS)
    return `${mark('ADDRESS', `${random.int(1, 140)} ${random.pick(STREETS.en)}`)}, ${mark('PLACE', town)} ${mark('POSTCODE', postcode)}`
  }
  const [postcode, town] = random.chance(0.6) ? random.pick(AT_TOWNS) : random.pick(DE_TOWNS)
  const number = random.chance(0.3) ? `${random.int(1, 90)}/${random.int(1, 12)}` : String(random.int(1, 140))
  return `${mark('ADDRESS', `${random.pick(STREETS.de)} ${number}`)}, ${mark('POSTCODE', postcode)} ${mark('PLACE', town)}`
}

// ---- Look-alikes that are not personal data ----

export function orderNumber(random: Random): string {
  return random.pick([
    `${random.digits(4)}-${random.digits(4)}-${random.digits(4)}`,
    `B-${random.digits(8)}`,
    `${random.int(10, 99)} ${random.digits(3)} ${random.digits(4)}`,
  ])
}

export function versionNumber(random: Random): string {
  return `${random.int(1, 9)}.${random.int(0, 30)}.${random.int(0, 9)}${random.chance(0.3) ? `.${random.int(0, 99)}` : ''}`
}

export function invoiceDate(random: Random, lang: Lang): string {
  const day = random.int(1, 28)
  const month = random.int(1, 12)
  const year = random.int(2023, 2026)
  return lang === 'de' ? `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}` : `${day} ${MONTHS.en[month - 1]} ${year}`
}

export function amount(random: Random, lang: Lang): string {
  const value = random.int(9, 2499)
  const cents = random.pick(['00', '50', '90', '99'])
  return lang === 'de' ? `€ ${value.toLocaleString('de-AT')},${cents}` : `€${value.toLocaleString('en-GB')}.${cents}`
}

export function ticketNumber(random: Random): string {
  return `#${random.int(10000, 99999)}`
}
