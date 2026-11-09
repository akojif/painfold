import { isValidCardNumber } from './checksums.ts'
import { detection, type Detector } from './types.ts'

// 12 to 19 digits, optionally grouped by spaces, dashes or dots, not part of a longer number.
const CANDIDATE = /(?<![\d-]|\d\.)\d(?:[ .-]?\d){11,18}(?![\d-]|[ .-]\d)/g
// Dots also separate IP addresses and amounts, so a dotted card number must
// be written in groups of four, as printed on the card.
const DOTTED = /^\d{4}(?:\.\d{4}){2,3}(?:\.\d{1,3})?$/

/**
 * Payment card numbers. A candidate must use one kind of separator at most,
 * start with a known network prefix at a length that network issues, and pass
 * the Luhn check, so ticket and order numbers are left alone.
 */
export const cardDetector: Detector = {
  type: 'CARD',
  detect: text => [...text.matchAll(CANDIDATE)].flatMap((match) => {
    const separators = new Set(match[0].replace(/\d/g, ''))
    const digits = match[0].replace(/\D/g, '')
    if (separators.has('.') && !DOTTED.test(match[0])) return []
    return separators.size <= 1 && isValidCardNumber(digits) ? [detection('CARD', text, match.index, match.index + match[0].length)] : []
  }),
}
