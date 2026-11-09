<script setup lang="ts">
defineProps<{ current: number }>()
const steps = ['import', 'review', 'download'] as const
</script>

<template>
  <nav
    :aria-label="$t('nav.label')"
    class="border-b border-rule px-4 py-3 md:w-44 md:shrink-0 md:border-r md:border-b-0 md:px-6 md:py-12"
  >
    <p class="text-sm text-ink-muted md:hidden">
      {{ $t('nav.stepOf', { current, total: steps.length, name: $t(`nav.steps.${steps[current - 1]}`) }) }}
    </p>
    <ol class="hidden space-y-3 md:block">
      <li
        v-for="(step, index) in steps"
        :key="step"
        :aria-current="index + 1 === current ? 'step' : undefined"
        class="border-l-2 pl-3"
        :class="index + 1 === current ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-muted'"
      >
        <span class="mr-2 tabular-nums">{{ index + 1 }}</span>{{ $t(`nav.steps.${step}`) }}
      </li>
    </ol>
  </nav>
</template>
