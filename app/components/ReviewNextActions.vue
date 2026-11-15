<script setup lang="ts">
// What comes after the review (#142): continue to analyze (primary), or only
// download the cleaned file (a clearly visible secondary button); the review
// explains the choice in one line next to them. Both wait while names are
// still being checked, so neither the file nor the analysis misses a name.
defineProps<{ waiting: boolean }>()
const localePath = useLocalePath()
const SECONDARY = 'focus-ring press inline-flex h-9 items-center rounded-md border border-line-strong bg-canvas px-3.5 font-medium hover:border-fg'
const PRIMARY = 'focus-ring press inline-flex h-9 items-center rounded-md bg-fg px-3.5 font-medium text-canvas'
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <template v-if="waiting">
      <button
        type="button"
        disabled
        aria-describedby="download-waits"
        :class="SECONDARY"
        class="opacity-50"
      >
        {{ $t('review.downloadFile') }}
      </button>
      <button
        type="button"
        disabled
        aria-describedby="download-waits"
        :class="PRIMARY"
        class="opacity-50"
      >
        {{ $t('review.continue') }}
      </button>
    </template>
    <template v-else>
      <NuxtLink
        :to="localePath('/download')"
        :class="SECONDARY"
      >
        {{ $t('review.downloadFile') }}
      </NuxtLink>
      <NuxtLink
        :to="localePath('/analyze')"
        :class="PRIMARY"
      >
        {{ $t('review.continue') }}
      </NuxtLink>
    </template>
  </div>
</template>
