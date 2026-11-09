<script setup lang="ts">
defineProps<{ current: number }>()
const steps = ['import', 'review', 'download'] as const
</script>

<template>
  <nav :aria-label="$t('nav.label')">
    <ol class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <li
        v-for="(step, index) in steps"
        :key="step"
        class="flex items-center gap-3"
        :aria-current="index + 1 === current ? 'step' : undefined"
      >
        <span
          v-if="index > 0"
          aria-hidden="true"
          class="hidden h-px w-10 bg-rule-strong sm:block"
        />
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
          :class="index + 1 === current
            ? 'bg-ink text-desk'
            : index + 1 < current ? 'bg-signal text-on-signal' : 'border border-rule-strong text-ink-muted'"
        >
          <svg
            v-if="index + 1 < current"
            aria-hidden="true"
            viewBox="0 0 16 16"
            class="size-3.5 fill-none stroke-current stroke-2"
          ><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>
          <span
            v-else
            aria-hidden="true"
          >{{ index + 1 }}</span>
        </span>
        <span
          class="text-sm"
          :class="index + 1 === current ? 'font-semibold text-ink' : 'text-ink-muted'"
        >
          {{ $t(`nav.steps.${step}`) }}<span
            v-if="index + 1 < current"
            class="sr-only"
          >, {{ $t('nav.done') }}</span>
        </span>
      </li>
    </ol>
  </nav>
</template>
