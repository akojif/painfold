const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false

/**
 * Lets a file be dropped anywhere on the page. Without this, a browser opens a
 * dropped file itself and leaves the app, losing everything in memory, so file
 * drops are always caught; onFile only runs while accepting() is true.
 */
export function useFileDrop(onFile?: (file: File) => void, accepting: () => boolean = () => true) {
  const dragging = ref(false)
  let depth = 0

  const listeners: Record<'dragenter' | 'dragover' | 'dragleave' | 'drop', (event: DragEvent) => void> = {
    dragenter: (event) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth++
      dragging.value = Boolean(onFile) && accepting()
    },
    dragover: (event) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = onFile && accepting() ? 'copy' : 'none'
    },
    dragleave: () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) dragging.value = false
    },
    drop: (event) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      dragging.value = false
      const file = event.dataTransfer?.files[0]
      if (file && onFile && accepting()) onFile(file)
    },
  }

  onMounted(() => {
    for (const [type, listener] of Object.entries(listeners)) window.addEventListener(type, listener as EventListener)
  })
  onBeforeUnmount(() => {
    for (const [type, listener] of Object.entries(listeners)) window.removeEventListener(type, listener as EventListener)
  })

  return { dragging: readonly(dragging) }
}
