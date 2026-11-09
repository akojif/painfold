import { isValidSvnr } from './checksums.ts'
import { detection, type Detector } from './types.ts'

// Serial and check digit, an optional space, then the birth date: "1237 010180" or "1237010180".
const CANDIDATE = /(?<![\d.,/-])[1-9]\d{3}[ \u00A0]?\d{6}(?![\d/-]|[.,]\d)/g

/** Austrian social insurance numbers (Sozialversicherungsnummer) with a valid check digit and birth date. */
export const svnrDetector: Detector = {
  type: 'SVNR',
  detect: text => [...text.matchAll(CANDIDATE)].flatMap(match =>
    isValidSvnr(match[0].replace(/\D/g, '')) ? [detection('SVNR', text, match.index, match.index + match[0].length)] : []),
}
