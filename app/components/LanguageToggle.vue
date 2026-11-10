<script setup lang="ts">
// EN / DE in the header. Choosing a language moves to the same page in that
// language inside the app, so the open file and the review stay in memory, and
// remembers the choice in localStorage (no cookie) for the next visit to /.
type LanguageCode = 'en' | 'de'
// Read before first paint by the inline script in nuxt.config.ts, so keep the two in step.
const LANGUAGE_STORAGE_KEY = 'painfold-language'

const { locale } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const options: LanguageCode[] = ['en', 'de']

async function choose(code: LanguageCode) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code)
  }
  catch {
    // Storage can be unavailable (private windows, blocked storage); the switch still works.
  }
  if (code !== locale.value) await navigateTo(switchLocalePath(code))
}
</script>

<template>
  <div
    role="group"
    :aria-label="$t('language.label')"
    class="flex items-center gap-0.5 rounded-md border border-line p-0.5"
  >
    <button
      v-for="code in options"
      :key="code"
      type="button"
      :lang="code"
      class="press focus-ring grid h-7 min-w-8 place-items-center rounded-sm px-1.5 font-mono text-xs text-fg-muted uppercase hover:text-fg"
      :class="{ 'bg-surface text-fg shadow-raised': locale === code }"
      :aria-pressed="locale === code"
      :aria-label="$t(`language.${code}`)"
      :title="$t(`language.${code}`)"
      @click="choose(code)"
    >
      {{ code }}
    </button>
  </div>
</template>
