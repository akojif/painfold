import { IBAN_LENGTHS, isValidIban } from './checksums.ts'
import { detection, type Detection, type Detector } from './types.ts'

const START = /(?<![\p{L}\d])[A-Za-z]{2}\d{2}/gu
const isAlphanumeric = (char: string | undefined) => char !== undefined && /[A-Za-z0-9]/.test(char)

/**
 * IBANs in any common spelling: with or without spaces between groups, in
 * upper or lower case. Each country has a fixed length, so exactly that many
 * characters are read from the start, which keeps a following word out of the
 * match; then the mod-97 check decides.
 */
export const ibanDetector: Detector = {
  type: 'IBAN',
  detect: (text) => {
    const found: Detection[] = []
    for (const match of text.matchAll(START)) {
      const length = IBAN_LENGTHS[match[0].slice(0, 2).toUpperCase()]
      if (!length) continue
      let compact = ''
      let end = match.index
      while (end < text.length && compact.length < length) {
        const char = text[end]!
        if (isAlphanumeric(char)) compact += char
        else if (!((char === ' ' || char === '\u00A0') && isAlphanumeric(text[end + 1]) && compact.length >= 4)) break
        end++
      }
      if (compact.length === length && !isAlphanumeric(text[end]) && isValidIban(compact)) found.push(detection('IBAN', text, match.index, end))
    }
    return found
  },
}
