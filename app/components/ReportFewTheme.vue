<script setup lang="ts">
// A theme found in only a few texts: its name and count on one line, and its
// evidence on request. Kept apart so the ranked themes read first.
import type { Theme } from '~~/core/ai/themes'

defineProps<{ theme: Theme }>()
const { number } = useFormat()
const open = ref(false)
const panel = useId()
</script>

<template>
  <li>
    <button
      type="button"
      class="focus-ring press flex items-baseline gap-3 rounded-sm py-0.5 text-left hover:underline hover:underline-offset-4"
      :aria-expanded="open"
      :aria-controls="panel"
      @click="open = !open"
    >
      <span>{{ theme.name }}</span>
      <span class="font-mono text-sm text-fg-muted tabular-nums">{{ number(theme.count) }}<span class="sr-only">&nbsp;{{ $t('results.textsWord', theme.count) }}</span></span>
    </button>
    <ThemeEvidence
      v-if="open"
      :id="panel"
      class="mt-2 mb-4"
      :theme="theme"
    />
  </li>
</template>
