import { isValidSvnr } from './checksums.ts'
import { detection, type Detector } from './types.ts'

// Serial and check digit, an optional space or dash, then the birth date:
// "1237 010180", "1237010180" or "1237-010180".
const CANDIDATE = /(?<![\d.,/-])[1-9]\d{3}[ \u00A0-]?\d{6}(?![\d/-]|[.,]\d)/g
// "2025-000417" is how document numbers are written, and about 1 in 11 of
// them passes the check digit. With a dash, the date part must look like a
// date (day 01-31, month 01-12), which real SV-Nummern nearly always do.
const DATE_PART = /^(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])\d{2}$/

// About 1 in 11 ten-digit numbers passes the check digit, so a word just
// before the number that names it as an order, invoice or customer number
// rules it out: "Rechnung 4711190056", "Bestell-Nr. …", "invoice no. …".
const REFERENCE_BEFORE = /(?:\brechnung\w*|\bbestell\w*|\bauftrag\w*|\bkunden\w*|\bticket\w*|\blieferschein\w*|\border\b|\binvoice\b|\bcustomer\b)(?:[-.\s]*(?:nr|no|nummer|number|id)\b\.?)?\s*[:.#]?\s*$/iu

/**
 * Austrian social insurance numbers (Sozialversicherungsnummer) with a valid
 * check digit (see isValidSvnr), unless an order, invoice or customer word
 * comes right before them.
 */
export const svnrDetector: Detector = {
  type: 'SVNR',
  detect: text => [...text.matchAll(CANDIDATE)].flatMap((match) => {
    if (!isValidSvnr(match[0].replace(/\D/g, ''))) return []
    if (match[0].includes('-') && !DATE_PART.test(match[0].slice(-6))) return []
    if (REFERENCE_BEFORE.test(text.slice(Math.max(0, match.index - 40), match.index))) return []
    return [detection('SVNR', text, match.index, match.index + match[0].length)]
  }),
}
