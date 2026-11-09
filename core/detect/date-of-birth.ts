import { detection, type Detection, type Detector } from './types.ts'

// Words that say the date that follows is a birth date.
// Letter lookarounds, not \b: "geb." ends in a dot, which \b cannot follow.
const CONTEXT = /(?<!\p{L})(?:geboren(?: am)?|geburtsdatum|geburtstag|geb\.?-?datum|geb\.|date of birth|birth ?date|birthday|d\.o\.b\.|dob|born(?: on)?)(?!\p{L})/giu

// What may stand between the word and the date: ":", "am", "on", "is", "the", "(".
const BRIDGE = /^[\s:(,-]*(?:(?:am|on|is|ist|the|der|den|vom)\s+)?/iu

const MONTHS: Record<string, number> = {
  jänner: 1, januar: 1, january: 1, jan: 1, feber: 2, februar: 2, february: 2, feb: 2, märz: 3, march: 3, mär: 3, mar: 3,
  april: 4, apr: 4, mai: 5, may: 5, juni: 6, june: 6, jun: 6, juli: 7, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sept: 9, sep: 9, oktober: 10, october: 10, okt: 10, oct: 10, november: 11, nov: 11, dezember: 12, december: 12, dez: 12, dec: 12,
}
const MONTH_NAME = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')

// Date formats people write: 12.03.1987, 3.4.90, 12/03/1987, 1987-03-12,
// 12. März 1987, 21 July 1985, March 21, 1985.
const DATE_FORMATS: { pattern: RegExp, parts: (m: RegExpExecArray) => [day: number, month: number, year: number] }[] = [
  { pattern: /^(\d{4})-(\d{1,2})-(\d{1,2})\b/, parts: m => [Number(m[3]), Number(m[2]), Number(m[1])] },
  { pattern: /^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/, parts: m => [Number(m[1]), Number(m[2]), year(m[3]!)] },
  { pattern: new RegExp(`^(\\d{1,2})\\.?\\s+(${MONTH_NAME})\\.?\\s+(\\d{4})\\b`, 'iu'), parts: m => [Number(m[1]), MONTHS[m[2]!.toLowerCase()]!, Number(m[3])] },
  { pattern: new RegExp(`^(${MONTH_NAME})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'iu'), parts: m => [Number(m[2]), MONTHS[m[1]!.toLowerCase()]!, Number(m[3])] },
]

function year(value: string): number {
  if (value.length === 4) return Number(value)
  // Two-digit years: 00-29 read as 20xx, the rest as 19xx (a birth date, so not in the future).
  const short = Number(value)
  return short < 30 ? 2000 + short : 1900 + short
}

const plausible = (day: number, month: number, birthYear: number) =>
  month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(birthYear, month, 0)).getUTCDate() && birthYear >= 1900 && birthYear <= 2030

/**
 * Dates of birth, only next to a word that says so ("geboren am", "geb.",
 * "Geburtsdatum", "date of birth", "DOB", "born on"), so invoice and contract
 * dates are left alone. Only the date itself is detected.
 */
export const dateOfBirthDetector: Detector = {
  type: 'DATE_OF_BIRTH',
  detect: (text) => {
    const found: Detection[] = []
    for (const context of text.matchAll(CONTEXT)) {
      const after = context.index + context[0].length
      const bridge = BRIDGE.exec(text.slice(after, after + 12))?.[0].length ?? 0
      const rest = text.slice(after + bridge, after + bridge + 30)
      for (const format of DATE_FORMATS) {
        const date = format.pattern.exec(rest)
        if (!date) continue
        if (plausible(...format.parts(date))) found.push(detection('DATE_OF_BIRTH', text, after + bridge, after + bridge + date[0].length))
        break
      }
    }
    return found
  },
}
