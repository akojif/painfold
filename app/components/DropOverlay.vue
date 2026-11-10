<script setup lang="ts">
// While a file is dragged over the page: the page dims and a sheet outline
// rises to receive it. After a drop the sheet stays while the file is checked.
// A table makes it go at once. A file that does not open shows its message on
// the sheet for 1.5 s, then the sheet shrinks down into the toast, which takes
// over (with the roadmap link where there is one). Transitions, not keyframes,
// so it can always be interrupted; only opacity and transform; in 200 ms, out
// faster, the shrink in 320 ms as one movement across the screen. With reduced
// motion it appears and disappears at once, and the toast is shown directly.
const props = defineProps<{ visible: boolean }>()
const { dropFeedback, settleDrop } = useOpenFile()

const SHOW_OUTCOME = 1500
const SHRINK = 320

const rendered = ref(false)
const raised = ref(false)
// The dropped file's message while the sheet shows it, and while it shrinks.
const message = ref<string>()
const shrinking = ref(false)
const sheet = useTemplateRef<HTMLElement>('sheet')
const timers: Array<ReturnType<typeof setTimeout>> = []
const later = (ms: number, then: () => void) => timers.push(setTimeout(then, ms))
const clearTimers = () => timers.splice(0).forEach(clearTimeout)

function raise() {
  rendered.value = true
  // One frame in the lowered state first, so the change is a transition.
  requestAnimationFrame(() => requestAnimationFrame(() => (raised.value = true)))
}

function lower() {
  raised.value = false
  later(120, () => {
    rendered.value = false
    message.value = undefined
  })
}

// Down to where the toast appears, small and fading, while the toast rises.
function shrink() {
  const element = sheet.value
  if (!element) return settleDrop()
  const rect = element.getBoundingClientRect()
  const dx = window.innerWidth / 2 - (rect.left + rect.width / 2)
  const dy = window.innerHeight - 80 - (rect.top + rect.height / 2)
  shrinking.value = true
  element.style.transform = `translate(${dx}px, ${dy}px) scale(0.3)`
  raised.value = false
  later(SHRINK * 0.5, settleDrop)
  later(SHRINK, () => {
    rendered.value = false
    shrinking.value = false
    message.value = undefined
    element.style.transform = ''
  })
}

watch(() => [props.visible, dropFeedback.value] as const, ([visible, feedback]) => {
  if (visible) {
    // Dragging again: whatever the last drop had to say goes to the toast now.
    clearTimers()
    if (message.value && !shrinking.value) settleDrop()
    message.value = undefined
    shrinking.value = false
    if (sheet.value) sheet.value.style.transform = ''
    raise()
    return
  }
  if (feedback?.phase === 'checking') return
  if (feedback?.phase === 'outcome' && !message.value) {
    clearTimers()
    message.value = feedback.toast.message
    if (!rendered.value) raise()
    later(SHOW_OUTCOME, shrink)
    return
  }
  if (!feedback && !message.value) {
    clearTimers()
    lower()
  }
})
onBeforeUnmount(clearTimers)
</script>

<template>
  <div
    v-if="rendered"
    class="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-canvas/85 p-6 transition-opacity motion-reduce:transition-none"
    :class="raised ? 'opacity-100 duration-200 ease-out' : shrinking ? 'opacity-0 duration-[320ms] ease-in-out' : 'opacity-0 duration-[120ms] ease-out'"
    data-testid="drop-overlay"
    aria-hidden="true"
  >
    <div
      ref="sheet"
      class="grid aspect-[3/4] w-56 place-items-center rounded-md border-2 border-dashed bg-canvas px-6 text-center shadow-overlay transition-[transform,opacity] motion-reduce:transition-none"
      :class="[
        message ? 'border-line-strong' : 'border-accent',
        shrinking ? 'opacity-0 duration-[320ms] ease-in-out' : raised ? 'translate-y-0 scale-100 opacity-100 duration-200 ease-out' : 'translate-y-3 scale-[0.98] opacity-0 duration-[120ms] ease-out',
      ]"
      data-testid="drop-sheet"
    >
      <p
        class="font-medium text-balance"
        :class="message ? 'text-sm' : 'text-md'"
      >
        {{ message ?? $t('start.dropOverlay') }}
      </p>
    </div>
  </div>
</template>
