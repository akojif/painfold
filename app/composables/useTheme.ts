export type ThemeChoice = 'system' | 'light' | 'dark'

// The one thing Painfold stores in the browser: this preference. "System"
// removes it. The inline script in nuxt.config applies it before first paint.
export const THEME_STORAGE_KEY = 'painfold-theme'

const choice = ref<ThemeChoice>('system')

export function useTheme() {
  onMounted(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      choice.value = saved === 'light' || saved === 'dark' ? saved : 'system'
    }
    catch {
      choice.value = 'system'
    }
  })

  function set(next: ThemeChoice) {
    choice.value = next
    const root = document.documentElement
    if (next === 'system') delete root.dataset.theme
    else root.dataset.theme = next
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, next)
    }
    catch {
      // Storage can be blocked (private mode, settings); the choice still applies for this visit.
    }
  }

  return { choice: readonly(choice), set }
}
