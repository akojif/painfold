<script setup lang="ts">
// While a file is dragged over the page: the page dims and a sheet outline
// rises to receive it. Transitions, not keyframes, so dragging in and out
// quickly reverses smoothly; in 200 ms, out faster in 120 ms; only opacity
// and transform. With reduced motion it appears and disappears at once.
const props = defineProps<{ visible: boolean }>()

const rendered = ref(false)
const raised = ref(false)
let leaving: ReturnType<typeof setTimeout> | undefined

watch(() => props.visible, (visible) => {
  clearTimeout(leaving)
  if (visible) {
    rendered.value = true
    // One frame in the lowered state first, so the change is a transition.
    requestAnimationFrame(() => requestAnimationFrame(() => (raised.value = props.visible)))
  }
  else {
    raised.value = false
    leaving = setTimeout(() => (rendered.value = false), 120)
  }
})
onBeforeUnmount(() => clearTimeout(leaving))
</script>

<template>
  <div
    v-if="rendered"
    class="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-canvas/85 p-6 transition-opacity ease-out motion-reduce:transition-none"
    :class="raised ? 'opacity-100 duration-200' : 'opacity-0 duration-[120ms]'"
    data-testid="drop-overlay"
    aria-hidden="true"
  >
    <div
      class="grid aspect-[3/4] w-56 place-items-center rounded-md border-2 border-dashed border-accent bg-canvas px-6 text-center shadow-overlay transition-[transform,opacity] ease-out motion-reduce:transition-none"
      :class="raised ? 'translate-y-0 scale-100 opacity-100 duration-200' : 'translate-y-3 scale-[0.98] opacity-0 duration-[120ms]'"
    >
      <p class="text-md font-medium text-balance">
        {{ $t('start.dropOverlay') }}
      </p>
    </div>
  </div>
</template>
