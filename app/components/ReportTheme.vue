<script setup lang="ts">
// One theme in the report: its name in the customers' words, then the numbers
// counted in code (texts, share, intensity), then its evidence. On wide
// screens the numbers line up under the section's column labels; on a phone
// they share one line under the name.
import { barLength, intensityLevel } from '~~/core/ai/results'
import type { Theme } from '~~/core/ai/themes'

const props = defineProps<{ theme: Theme, largestShare: number }>()
const { number, percent, decimal } = useFormat()
const level = computed(() => intensityLevel(props.theme.intensity))
</script>

<template>
  <li class="border-t border-line py-5">
    <div class="grid gap-y-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_10rem_8rem] sm:items-baseline sm:gap-x-6">
      <h3 class="font-medium text-pretty">
        {{ theme.name }}
      </h3>
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm sm:contents">
        <p class="font-mono tabular-nums sm:text-right">
          {{ number(theme.count) }}<span class="ml-1 font-sans text-fg-muted sm:sr-only">{{ $t('results.textsWord', theme.count) }}</span>
        </p>
        <p class="flex items-center gap-3">
          <span class="w-10 font-mono tabular-nums">
            <span class="sr-only">{{ $t('results.column.share') }} </span>{{ percent(theme.share) }}
          </span>
          <span
            aria-hidden="true"
            class="h-1 w-24 overflow-hidden rounded-full bg-line sm:w-auto sm:flex-1"
          >
            <span
              class="block h-full origin-left bg-fg-muted"
              :style="{ transform: `scaleX(${barLength(theme.share, largestShare)})` }"
            />
          </span>
        </p>
        <p>
          <span class="sr-only">{{ $t('results.column.intensity') }} </span>{{ $t(`results.intensity.${level}`) }}
          <span class="font-mono text-fg-muted tabular-nums">{{ decimal(theme.intensity, 1) }}</span><span class="sr-only">&nbsp;{{ $t('results.intensity.outOf') }}</span>
        </p>
      </div>
    </div>
    <ThemeEvidence
      class="mt-3"
      :theme="theme"
    />
  </li>
</template>
