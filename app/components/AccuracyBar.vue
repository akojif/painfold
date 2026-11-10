<script setup lang="ts">
// A simple bar for a share between 0 and 1, with an optional target line. Drawn
// in SVG, so its width is an attribute: the page is prerendered and the
// Content-Security-Policy allows no style attributes. Below the target the bar
// turns red; the text next to it says so too, so colour is never the only cue.
const props = defineProps<{ value: number, target?: number }>()
const below = computed(() => props.target !== undefined && props.value < props.target)
const width = computed(() => Math.max(0, Math.min(1, props.value)) * 100)
</script>

<template>
  <svg
    viewBox="0 0 100 6"
    preserveAspectRatio="none"
    aria-hidden="true"
    class="block h-1.5 w-full overflow-visible"
  >
    <rect
      width="100"
      height="6"
      rx="1"
      class="fill-line"
    />
    <rect
      :width="width"
      height="6"
      rx="1"
      :class="below ? 'fill-danger' : 'fill-accent'"
    />
    <line
      v-if="target !== undefined"
      :x1="target * 100"
      :x2="target * 100"
      y1="-2"
      y2="8"
      vector-effect="non-scaling-stroke"
      class="stroke-fg-muted"
      stroke-width="1"
    />
  </svg>
</template>
