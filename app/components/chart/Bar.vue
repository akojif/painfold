<script setup lang="ts">
// One horizontal bar for a value between 0 and 1, on a track, with an optional
// target line (#141, Charts). Drawn in SVG, so its length is an attribute: pages
// are prerendered and the Content-Security-Policy allows no style attributes.
// The bar is decoration only (aria-hidden): the number is always written next
// to it, in the same row or table cell, so screen readers and colour-blind
// readers get the value as text. Colours come from the chart tokens, checked
// for contrast in light and dark (tests/unit/design-tokens.test.ts):
// - neutral: a magnitude, such as a theme's share in the report;
// - accent: a measured rate, such as accuracy; below its target it turns to
//   danger, and the page says "below target" in words, never by colour alone.
const props = withDefaults(defineProps<{ value: number, target?: number, tone?: 'neutral' | 'accent' }>(), { tone: 'neutral' })
const below = computed(() => props.target !== undefined && props.value < props.target)
const width = computed(() => Math.max(0, Math.min(1, props.value)) * 100)
const fill = computed(() => (below.value ? 'fill-danger' : props.tone === 'accent' ? 'fill-accent' : 'fill-chart-bar'))
</script>

<template>
  <svg
    viewBox="0 0 100 6"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
    class="block h-1.5 w-full overflow-visible"
    :data-value="value"
  >
    <rect
      width="100"
      height="6"
      rx="1"
      class="fill-chart-track"
    />
    <rect
      :width="width"
      height="6"
      rx="1"
      :class="fill"
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
