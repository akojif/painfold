/** Numbers and lists formatted for the interface language. */
export function useFormat() {
  // The locale's language tag (de-AT, not just de), so formats follow Austrian conventions.
  const { localeProperties } = useI18n()
  const tag = () => localeProperties.value.language ?? 'en'
  const number = (value: number) => new Intl.NumberFormat(tag()).format(value)
  const list = (items: string[]) => new Intl.ListFormat(tag(), { type: 'conjunction' }).format(items)
  /** A share between 0 and 1 as a whole percentage: 0.97 is "97%" in English, "97 %" in German. */
  const percent = (share: number) => new Intl.NumberFormat(tag(), { style: 'percent', maximumFractionDigits: 0 }).format(share)
  /** A number with exactly this many decimals: 2.6 in English, 2,6 in German. */
  const decimal = (value: number, digits: number) => new Intl.NumberFormat(tag(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
  /** A date as people write it: 16 November 2026, 16. November 2026. */
  const date = (iso: string) => new Intl.DateTimeFormat(tag(), { dateStyle: 'long' }).format(new Date(iso))
  return { number, list, percent, decimal, date }
}
