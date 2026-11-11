// Painfold is made for a larger screen: below 768 px wide (by width, not by
// device) the start screen explains the product, and its two actions first
// suggest a laptop (SmallScreenSheet.vue). "Continue anyway" lets the whole
// flow run on the phone for the rest of the visit; nobody is blocked. On a
// small screen the name model (152 MB) is never offered.
export const SMALL_SCREEN = '(max-width: 767px)'

const narrow = ref(false)
// Chosen once per visit, kept in memory only: nothing is stored.
const continued = ref(false)
let watching = false

export function useSmallScreen() {
  if (import.meta.client && !watching) {
    watching = true
    const query = matchMedia(SMALL_SCREEN)
    narrow.value = query.matches
    query.addEventListener('change', event => (narrow.value = event.matches))
  }

  /** Whether an action should first suggest a bigger screen. */
  const suggestBiggerScreen = () => narrow.value && !continued.value

  return { narrow: readonly(narrow), continued, suggestBiggerScreen }
}
