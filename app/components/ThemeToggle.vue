<script setup lang="ts">
import type { ThemeChoice } from '~/composables/useTheme'

const { choice, set } = useTheme()
const options: { value: ThemeChoice, icon: string }[] = [
  { value: 'system', icon: 'M3 5h18v11H3z M8 20h8 M12 16v4' },
  { value: 'light', icon: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10' },
  { value: 'dark', icon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5' },
]
</script>

<template>
  <div
    role="group"
    :aria-label="$t('theme.label')"
    class="flex items-center gap-0.5 rounded-md border border-line p-0.5"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="press focus-ring grid size-7 place-items-center rounded-sm text-fg-muted hover:text-fg"
      :class="{ 'bg-surface text-fg shadow-raised': choice === option.value }"
      :aria-pressed="choice === option.value"
      :aria-label="$t(`theme.${option.value}`)"
      :title="$t(`theme.${option.value}`)"
      @click="set(option.value)"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        class="size-4 fill-none stroke-current stroke-[1.6]"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><path :d="option.icon" /></svg>
    </button>
  </div>
</template>
