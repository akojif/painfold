import { isValidCardNumber } from './checksums.ts'
import { detection, type Detector } from './types.ts'

// 12 to 19 digits, optionally grouped by spaces or dashes, not part of a longer number.
const CANDIDATE = /(?<![\d-])\d(?:[ -]?\d){11,18}(?![\d-]|[ -]\d)/g

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
    return separators.size <= 1 && isValidCardNumber(digits) ? [detection('CARD', text, match.index, match.index + match[0].length)] : []
  }),
}
