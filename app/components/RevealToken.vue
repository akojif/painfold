<script setup lang="ts">
import type { PiiType } from '~~/core/pii-types'

// A placeholder in the start screen's example that shows what it replaced: on
// hover, keyboard focus or tap, a small tooltip says "Phone number removed:"
// with the original value, and the redaction wipe plays once more. The tooltip
// is announced through aria-describedby, stays open while hovered, and closes
// with Escape or a tap elsewhere. With reduced motion nothing animates.
defineProps<{ placeholder: string, type: PiiType, original: string }>()

const id = useId()
const open = ref(false)
const replays = ref(0)
const root = useTemplateRef<HTMLElement>('root')
const tip = useTemplateRef<HTMLElement>('tip')
const EDGE = 16

async function show() {
  if (open.value) return
  open.value = true
  replays.value++
  await nextTick()
  // Keep the tooltip on screen: shift it left by however far it would overflow.
  const element = tip.value
  if (!element) return
  element.style.left = ''
  const overflow = element.getBoundingClientRect().right - (document.documentElement.clientWidth - EDGE)
  if (overflow > 0) element.style.left = `${-overflow}px`
}

const hide = () => (open.value = false)

// Hover is for a mouse only: a tap also fires emulated mouse events, and some
// browsers send a mouse-out right after it, which would close the tooltip again.
function onPointerEnter(event: PointerEvent) {
  if (event.pointerType === 'mouse') void show()
}
function onPointerLeave(event: PointerEvent) {
  if (event.pointerType === 'mouse') hide()
}

// Touch has no hover: a tap toggles. A mouse click or Enter keeps it open.
let pointerType = ''
let wasOpen = false
function onPointerDown(event: PointerEvent) {
  pointerType = event.pointerType
  wasOpen = open.value
}
function onClick() {
  if (pointerType === 'touch' && wasOpen) hide()
  else void show()
  pointerType = ''
}

function onDocumentPointerDown(event: PointerEvent) {
  if (open.value && !root.value?.contains(event.target as Node)) hide()
}
onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
</script>

<template>
  <span
    ref="root"
    class="relative inline-block"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
  >
    <button
      type="button"
      class="focus-ring cursor-help rounded-sm align-baseline"
      :aria-describedby="id"
      :aria-expanded="open"
      @focus="show"
      @blur="hide"
      @pointerdown="onPointerDown"
      @click="onClick"
      @keydown.esc.prevent="hide"
    >
      <RedactionToken
        :key="replays"
        :placeholder="placeholder"
        motion="wipe"
      />
    </button>
    <span
      v-show="open"
      :id="id"
      ref="tip"
      role="tooltip"
      class="absolute bottom-full left-0 z-10 mb-2 w-max max-w-[min(18rem,80vw)] origin-bottom-left rounded-md border border-line bg-canvas px-2.5 py-1.5 text-left text-xs leading-5 shadow-overlay animate-overlay-in"
    >
      <span class="block font-medium text-fg">{{ $t('example.removed', { type: $t(`typeOne.${type}`) }) }}</span>
      <span class="block font-mono break-all text-fg-muted">{{ original }}</span>
    </span>
  </span>
</template>
