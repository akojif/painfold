import { isValidAustrianUid, isValidGermanVatId } from './checksums.ts'
import { detection, type Detector } from './types.ts'

const CANDIDATE = /(?<![\p{L}\d])(ATU|DE)[ \u00A0]?(\d{8,9})(?!\d)/gu

/** Austrian UIDs (ATU…) and German VAT IDs (DE…) with valid check digits. */
export const vatDetector: Detector = {
  type: 'VAT_ID',
  detect: text => [...text.matchAll(CANDIDATE)].flatMap((match) => {
    const id = `${match[1]}${match[2]}`
    const valid = match[1] === 'ATU' ? isValidAustrianUid(id) : isValidGermanVatId(id)
    return valid ? [detection('VAT_ID', text, match.index, match.index + match[0].length)] : []
  }),
}
