// Short pieces of information that need no decision, shown at the bottom of
// the screen (ToastRegion.vue): what happened to a file that did not open, for
// example. Decisions, such as starting over, are dialogs (useConfirm), never
// toasts. A toast stays about 8 seconds, longer while it is hovered or
// focused, and can be closed.
export type Toast = {
  id: number
  message: string
  /** info: something to know. problem: something did not work. */
  tone: 'info' | 'problem'
  link?: { to: string, label: string }
}

export const TOAST_DURATION = 8000

const toasts = ref<Toast[]>([])
let lastId = 0

export function useToast() {
  function show(toast: Omit<Toast, 'id'>) {
    // One message at a time: a new one replaces the one before, so nothing piles up.
    toasts.value = [{ ...toast, id: ++lastId }]
  }

  function close(id: number) {
    toasts.value = toasts.value.filter(toast => toast.id !== id)
  }

  return { toasts: readonly(toasts), show, close }
}
