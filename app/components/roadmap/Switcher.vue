<script setup lang="ts">
// Prototype only (proto/roadmap): swaps between the three roadmap variations.
// It floats in the bottom right corner, and while it is there the page gets
// as much room at the bottom, so it never covers the content or the footer.
const variant = defineModel<RoadmapVariant>({ required: true })

onMounted(() => document.body.style.setProperty('padding-bottom', '4.5rem'))
onBeforeUnmount(() => document.body.style.removeProperty('padding-bottom'))
</script>

<template>
  <div
    role="group"
    :aria-label="$t('roadmap.variants.label')"
    class="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-md border border-raised-line bg-raised p-1 shadow-float"
  >
    <span class="hidden pl-1.5 text-xs text-fg-muted sm:inline">{{ $t(`roadmap.variants.${variant}`) }}</span>
    <button
      v-for="option in ROADMAP_VARIANTS"
      :key="option"
      type="button"
      class="press focus-ring size-9 rounded-sm font-mono text-sm uppercase"
      :class="variant === option ? 'bg-fg text-canvas' : 'text-fg-muted hover:bg-surface hover:text-fg'"
      :aria-pressed="variant === option"
      :aria-label="`${option.toUpperCase()}: ${$t(`roadmap.variants.${option}`)}`"
      @click="variant = option"
    >
      {{ option }}
    </button>
  </div>
</template>
