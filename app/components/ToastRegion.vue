<script setup lang="ts">
// Where toasts appear: floating 28 px above the bottom on larger screens
// (centred) and on small ones (full width), and lifted above anything docked
// to the bottom of the screen that is in view, marked data-toast-avoid (the
// footer, the column step's action bar, the review's panel on small screens),
// so a toast never covers them. Above everything except dialogs, which sit in
// the browser's top layer. One live region (role="status") that is always
// there, so screen readers announce what appears in it. A toast pauses while
// it is hovered or has focus. It rises in 200 ms with a slight scale and leaves
// faster; transform and opacity only; none with reduced motion.
import type { Toast } from '~/composables/useToast'

const { toasts, close } = useToast()
const region = useTemplateRef<HTMLElement>('region')
const lift = ref(0)

const timers = new Map<number, { left: number, started: number, handle?: ReturnType<typeof setTimeout> }>()

function run(toast: Toast) {
  const timer = timers.get(toast.id) ?? { left: TOAST_DURATION, started: 0 }
  timer.started = Date.now()
  timer.handle = setTimeout(() => close(toast.id), timer.left)
  timers.set(toast.id, timer)
}
function pause(toast: Toast) {
  const timer = timers.get(toast.id)
  if (!timer?.handle) return
  clearTimeout(timer.handle)
  timer.handle = undefined
  timer.left = Math.max(1000, timer.left - (Date.now() - timer.started))
}
function resume(toast: Toast, event?: FocusEvent) {
  // Focus moving within the toast is not leaving it.
  if (event?.relatedTarget instanceof Node && (event.currentTarget as HTMLElement).contains(event.relatedTarget)) return
  if (!timers.get(toast.id)?.handle) run(toast)
}

// The gap between a toast and the bottom of the screen, or what it floats above.
const GAP = 28

// How far anything marked data-toast-avoid reaches up from the bottom of the
// screen (a docked bar, or the footer once it scrolls into view), so the
// toast floats above it.
function measure() {
  let height = 0
  for (const element of document.querySelectorAll<HTMLElement>('[data-toast-avoid]')) {
    const rect = element.getBoundingClientRect()
    // Only what reaches the bottom of the screen: a bar docked there, or the footer once it is in view.
    if (rect.height > 0 && rect.top < window.innerHeight && rect.bottom >= window.innerHeight - 1) height = Math.max(height, window.innerHeight - rect.top)
  }
  lift.value = height
}
watch(lift, (height) => {
  if (region.value) region.value.style.bottom = `${height + GAP}px`
}, { immediate: true })
onMounted(() => {
  if (region.value) region.value.style.bottom = `${lift.value + GAP}px`
})

watch(toasts, (now, before = []) => {
  for (const toast of now) if (!before.some(old => old.id === toast.id)) run(toast)
  for (const old of before) {
    if (now.some(toast => toast.id === old.id)) continue
    clearTimeout(timers.get(old.id)?.handle)
    timers.delete(old.id)
  }
  if (now.length > 0) measure()
}, { immediate: true })

onMounted(() => {
  addEventListener('scroll', measure, { passive: true })
  addEventListener('resize', measure)
})
onBeforeUnmount(() => {
  removeEventListener('scroll', measure)
  removeEventListener('resize', measure)
  for (const timer of timers.values()) clearTimeout(timer.handle)
})
</script>

<template>
  <div
    ref="region"
    role="status"
    aria-live="polite"
    class="pointer-events-none fixed inset-x-0 bottom-7 z-[60] flex flex-col items-center gap-2 px-4 sm:px-6"
  >
    <TransitionGroup
      enter-active-class="transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
      enter-from-class="translate-y-3 scale-[0.96] opacity-0"
      leave-active-class="transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none"
      leave-to-class="translate-y-1 scale-[0.98] opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex w-full items-start gap-3 rounded-md border border-raised-line bg-raised px-4 py-3 text-sm shadow-float sm:w-auto sm:max-w-lg"
        data-testid="toast"
        @mouseenter="pause(toast)"
        @mouseleave="resume(toast)"
        @focusin="pause(toast)"
        @focusout="resume(toast, $event)"
      >
        <span
          aria-hidden="true"
          class="mt-1.5 size-1.5 shrink-0 rounded-full"
          :class="toast.tone === 'problem' ? 'bg-danger' : 'bg-accent'"
        />
        <p class="min-w-0 flex-1">
          {{ toast.message }}
          <NuxtLink
            v-if="toast.link"
            :to="toast.link.to"
            class="focus-ring rounded-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
            @click="close(toast.id)"
          >{{ toast.link.label }}</NuxtLink>
        </p>
        <button
          type="button"
          class="press focus-ring -my-0.5 shrink-0 rounded-sm text-fg-muted hover:text-fg"
          @click="close(toast.id)"
        >
          {{ $t('toast.close') }}
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
