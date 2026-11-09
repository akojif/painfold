<script setup lang="ts">
// One value in the example ticket: plain, then highlighted, then the ink bar
// sweeps over it and settles into its placeholder. Plays once after the page
// loads; with reduced motion it shows the end state straight away.
type Stage = 'plain' | 'highlight' | 'sweep' | 'done'
const props = defineProps<{ value: string, placeholder: string, highlightAt: number, sweepAt: number }>()

const stage = ref<Stage>('plain')
const root = useTemplateRef<HTMLElement>('root')
const valueEl = useTemplateRef<HTMLElement>('valueEl')
const placeholderEl = useTemplateRef<HTMLElement>('placeholderEl')
const timers: ReturnType<typeof setTimeout>[] = []

// Widths go through the DOM, never a :style binding: a server-rendered style
// attribute would be blocked by the Content-Security-Policy.
function setWidth(element: HTMLElement | null | undefined) {
  if (root.value && element) root.value.style.width = `${element.offsetWidth}px`
}

function settle() {
  setWidth(valueEl.value)
  requestAnimationFrame(() => {
    stage.value = 'done'
    setWidth(placeholderEl.value)
  })
}

onMounted(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.value = 'done'
    setWidth(placeholderEl.value)
    return
  }
  timers.push(
    setTimeout(() => (stage.value = 'highlight'), props.highlightAt),
    setTimeout(() => (stage.value = 'sweep'), props.sweepAt),
    setTimeout(settle, props.sweepAt + 260),
  )
})

onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<template>
  <span
    ref="root"
    class="relative inline-block overflow-hidden align-bottom whitespace-nowrap transition-[width] duration-300 ease-out motion-reduce:transition-none"
    :data-stage="stage"
  >
    <span
      ref="valueEl"
      class="inline-block px-1"
      :class="{
        'bg-highlighter text-on-highlighter': stage === 'highlight' || stage === 'sweep',
        'animate-highlight-in': stage === 'highlight',
        'invisible': stage === 'done',
      }"
    >{{ value }}</span>
    <span
      v-if="stage === 'sweep' || stage === 'done'"
      class="absolute inset-0 origin-left bg-redaction"
      :class="{ 'animate-ink-sweep': stage === 'sweep' }"
    />
    <span
      v-if="stage === 'done'"
      class="absolute inset-0 flex items-center justify-center font-mono text-[0.8em] text-on-redaction animate-ink-reveal"
    >{{ placeholder }}</span>
    <span
      ref="placeholderEl"
      aria-hidden="true"
      class="invisible absolute top-0 left-0 inline-block px-2 font-mono text-[0.8em]"
    >{{ placeholder }}</span>
  </span>
</template>
