/** Numbers and lists formatted for the interface language. */
export function useFormat() {
  // The locale's language tag (de-AT, not just de), so formats follow Austrian conventions.
  const { localeProperties } = useI18n()
  const tag = () => localeProperties.value.language ?? 'en'
  const number = (value: number) => new Intl.NumberFormat(tag()).format(value)
  const list = (items: string[]) => new Intl.ListFormat(tag(), { type: 'conjunction' }).format(items)
  return { number, list }
}
