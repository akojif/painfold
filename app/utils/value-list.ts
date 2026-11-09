import type { PiiType } from '~~/core/pii-types'
import type { Finding } from '~~/core/review/review'

/** A distinct value in the By value view: its first finding and how many rows it appears in. */
export interface ValueEntry { key: string, type: PiiType, finding: Finding, rows: number }

/** The values of one type, with how many findings of that type are still to review. */
export interface ValueGroup { type: PiiType, pending: number, values: ValueEntry[] }
