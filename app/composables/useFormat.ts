/** Numbers and lists formatted for the interface language. */
export function useFormat() {
  const { locale } = useI18n()
  const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
  const list = (items: string[]) => new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(items)
  return { number, list }
}
