import { detection, type Detection, type Detector } from './types.ts'

// A digit run with the separators people type in phone numbers: spaces, "/",
// "-", ".", and parentheses as in "+43 (0) 664" or "(030) 23125417".
const CANDIDATE = /(?<![\p{L}\d+])(?:\+|00)?\(?\d[\d \u00A0/().-]{5,22}\d(?!\d)/gu

// Words just before or after the number that say it is a phone number.
const PHONE_BEFORE = /(?:\btel\b\.?|\btelefon\w*|\bphone\b|\bhandy\w*|\bmobil\w*|\bmobile\b|\bnummer\b|\bnumber\b|\brückruf\w*|\bcall\b(?: me)?|\btext\b(?: me)?|\breach\b(?: me)?|\berreichbar\b|\bwhatsapp\b|\bsignal\b|\bhotline\b|\bfestnetz\b|\bdurchwahl\b|\bfax\b|\banrufen\b|\bruf\w* (?:mich|uns)\b)[^.\d]{0,25}$/iu
const PHONE_AFTER = /^[^.\d]{0,20}(?:\banrufen\b|\bzurückrufen\b|\bzurück\b|\bcall\b|\bruf\w* an\b)/iu

// Words just before the number that say it is something else, also as a
// compound with "Nr.", "No." or "Nummer" ("Bestell-Nr.", "Kunden-Nr.").
const NOT_PHONE_WORD = '(?:\\bbestell\\w*|\\brechnung\\w*|\\bre\\b|\\border\\b|\\binvoice\\b|\\bticket\\b|\\bkunden\\w*|\\bcustomer\\b|\\bauftrag\\w*|\\btracking\\b|\\bsendung\\w*|\\bplz\\b|\\bpostleitzahl\\b|\\bserie\\w*|\\bserial\\b|\\bartikel\\w*|\\barticle\\b|\\bvertrag\\w*|\\bcontract\\b|\\bkonto\\w*|\\baccount\\b|\\biban\\b|\\bbic\\b|\\bsumme\\b|\\bbetrag\\b|\\bamount\\b|\\bversion\\b|\\bbuild\\b|\\bref\\w*|\\baktenzeichen\\b|\\bzeitraum\\b|\\bid\\b|\\bversicherungs\\w*|\\bsozialversicherung\\w*|\\bsv\\b|\\buid\\b|\\bust\\w*|\\bvat\\b)'
const NOT_PHONE_BEFORE = new RegExp(`${NOT_PHONE_WORD}(?:[-.\\s]*(?:nr|no|nummer|number)\\b\\.?)?\\s*[:.#]?\\s*$`, 'iu')
// A bare "Nr." or "#" rules a number out too, unless a phone word comes right
// before it, as in "Tel.-Nr." or "Handy-Nr.".
const BARE_NUMBER_SIGN = /(?<!(?:tel|telefon|handy|mobil|fax|phone|ruf)\.?[-\s]?)(?:\bnr\b\.?|\bno\b\.?|#)\s*[:.]?\s*$/iu

// AT: Vienna 01, other areas 02-07, mobile 065x-069x. DE: areas 02-09, mobile
// 015x-017x. UK: 01, 02, 07. Followed by more digits.
const NATIONAL_PREFIX = /^\(?0(?:1|[2-9]\d|6[5-9]\d|1[5-7]\d)/
const COMPACT_MOBILE = /^0(?:6[5-9]\d|1[5-7]\d)\d{6,9}$/

const looksLikeDate = (value: string) =>
  /^\d{1,2}[./-]\d{1,2}[./-](?:\d{2}|\d{4})\b/.test(value) || /^\d{4}-\d{1,2}-\d{1,2}\b/.test(value)
const looksLikeAmount = (value: string) =>
  /^\d{1,3}(?:[. \u00A0]\d{3})+(?:,\d{1,2})?$/.test(value) && !/^0/.test(value)
const looksLikeIp = (value: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)

/** The token right before the candidate mixes letters and digits, as in a tracking code "1Z 999 AA1 01 2345". */
const afterCode = (before: string) => /(?:\p{L}+\d|\d+\p{L})[\p{L}\d]*\s*$/u.test(before)

/**
 * Phone numbers in Austrian, German, British and international formats. Digit
 * runs are common in feedback (orders, invoices, amounts), so a candidate must
 * look like a phone number on its own (international prefix, or a national
 * prefix written with separators, or a compact mobile number) or have a word
 * such as "Tel.", "Handy" or "call me" next to it. Words such as "Bestellung"
 * or "Rechnung" just before it rule it out.
 */
export const phoneDetector: Detector = {
  type: 'PHONE',
  detect: (text) => {
    const found: Detection[] = []
    for (const match of text.matchAll(CANDIDATE)) {
      // Trailing separators and unbalanced brackets belong to the sentence.
      let value = match[0].replace(/[ \u00A0/.(-]+$/, '')
      if ((value.match(/\)/g)?.length ?? 0) > (value.match(/\(/g)?.length ?? 0)) value = value.replace(/\)+$/, '')
      const digits = value.replace(/\D/g, '')
      if (digits.length < 7 || digits.length > 15) continue
      if (looksLikeDate(value) || looksLikeAmount(value) || looksLikeIp(value)) continue

      const before = text.slice(Math.max(0, match.index - 40), match.index)
      const after = text.slice(match.index + value.length, match.index + value.length + 30)
      if (NOT_PHONE_BEFORE.test(before) || BARE_NUMBER_SIGN.test(before) || afterCode(before)) continue

      const international = /^(?:\+|00)[1-9]/.test(value) && digits.length >= 9
      const separated = /[\s/().-]/.test(value)
      const national = NATIONAL_PREFIX.test(value) && separated && digits.length >= 8
      const context = PHONE_BEFORE.test(before) || PHONE_AFTER.test(after)
      if (international || national || COMPACT_MOBILE.test(value) || context) {
        found.push(detection('PHONE', text, match.index, match.index + value.length))
      }
    }
    return found
  },
}
