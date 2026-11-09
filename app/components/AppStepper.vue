<script setup lang="ts">
defineProps<{ current: number }>()
const steps = ['import', 'review', 'download'] as const
</script>

<template>
  <nav :aria-label="$t('nav.label')">
    <ol class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:gap-x-2.5">
      <li
        v-for="(step, index) in steps"
        :key="step"
        class="flex items-center gap-2.5"
        :aria-current="index + 1 === current ? 'step' : undefined"
      >
        <span
          v-if="index > 0"
          aria-hidden="true"
          class="h-px w-5 bg-line max-sm:hidden"
        />
        <span
          class="grid size-5 place-items-center rounded-full text-xs font-semibold tabular-nums"
          :class="index + 1 === current
            ? 'bg-fg text-canvas'
            : index + 1 < current ? 'bg-surface text-accent' : 'border border-line text-fg-muted'"
        >
          <svg
            v-if="index + 1 < current"
            aria-hidden="true"
            viewBox="0 0 16 16"
            class="size-3 fill-none stroke-current stroke-2"
          ><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>
          <span
            v-else
            aria-hidden="true"
          >{{ index + 1 }}</span>
        </span>
        <span :class="index + 1 === current ? 'font-medium text-fg' : 'text-fg-muted'">
          {{ $t(`nav.steps.${step}`) }}<span
            v-if="index + 1 < current"
            class="sr-only"
          >, {{ $t('nav.done') }}</span>
        </span>
      </li>
    </ol>
  </nav>
</template>
