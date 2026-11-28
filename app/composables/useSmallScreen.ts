// Painfold needs a larger screen (#139): below 768 px wide (by width, not by
// device), phones see what it does, and nothing more. The start page,
// roadmap, accuracy page and 404 stay readable; the start actions open
// SmallScreenSheet.vue; dropped files are ignored; and the working routes show
// SmallScreenNotice.vue instead (the layout decides, with a media query for
// the first paint). Widening the window turns the flow back on at once.
export const SMALL_SCREEN = '(max-width: 767px)'

const narrow = ref(false)
let watching = false

export function useSmallScreen() {
  if (import.meta.client && !watching) {
    watching = true
    const query = matchMedia(SMALL_SCREEN)
    narrow.value = query.matches
    query.addEventListener('change', event => (narrow.value = event.matches))
  }
  return { narrow: readonly(narrow) }
}

/** Puts the start page's address on the clipboard, or says to copy it by hand where that is not allowed. */
export function useCopyLink() {
  const localePath = useLocalePath()
  const copied = ref<'yes' | 'manual'>()
  const link = computed(() => (import.meta.client ? new URL(localePath('/'), location.origin).href : ''))
  async function copy() {
    try {
      await navigator.clipboard.writeText(link.value)
      copied.value = 'yes'
    }
    catch {
      copied.value = 'manual'
    }
  }
  return { link, copied, copy }
}
