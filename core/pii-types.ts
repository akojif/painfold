// Kinds of personal data Painfold labels and removes.
// NAME and PLACE are labelled in the evaluation set now and detected from Stage 2.
export const PII_TYPES = [
  'EMAIL',
  'PHONE',
  'IBAN',
  'CARD',
  'SVNR',
  'VAT_ID',
  'URL',
  'IP',
  'DATE_OF_BIRTH',
  'ADDRESS',
  'POSTCODE',
  'NAME',
  'PLACE',
] as const

export type PiiType = typeof PII_TYPES[number]
