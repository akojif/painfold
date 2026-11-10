<script setup lang="ts">
// The dialog for useConfirm(). A native modal dialog, so the rest of the page
// is inert and focus stays inside; "Keep working" has focus when it opens and
// Escape means the same. The destructive choice is styled as one.
const { question, respond } = useConfirm()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const keep = useTemplateRef<HTMLButtonElement>('keep')

watch(question, async (now) => {
  await nextTick()
  if (now && !dialog.value?.open) {
    dialog.value?.showModal()
    keep.value?.focus()
  }
  else if (!now && dialog.value?.open) dialog.value.close()
})

// Escape closes a native dialog by itself; it counts as "keep working".
function onClose() {
  if (question.value) respond(false)
}
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="confirm-title"
    aria-describedby="confirm-body"
    class="m-auto w-[calc(100%-2rem)] max-w-sm rounded-md border border-line bg-canvas p-0 text-fg shadow-overlay backdrop:bg-fg/20 open:animate-overlay-in"
    @close="onClose"
    @click.self="respond(false)"
  >
    <div
      v-if="question"
      class="space-y-2 px-5 pt-5"
    >
      <h2
        id="confirm-title"
        class="text-md font-semibold"
      >
        {{ question.title }}
      </h2>
      <p
        id="confirm-body"
        class="text-sm text-fg-muted"
      >
        {{ question.body }}
      </p>
    </div>
    <div
      v-if="question"
      class="flex flex-wrap justify-end gap-2 px-5 py-4"
    >
      <button
        ref="keep"
        type="button"
        class="press focus-ring h-9 rounded-md border border-line px-3.5 hover:border-line-strong"
        @click="respond(false)"
      >
        {{ question.cancel }}
      </button>
      <button
        type="button"
        class="press focus-ring h-9 rounded-md bg-danger px-3.5 font-medium text-on-danger hover:opacity-90"
        @click="respond(true)"
      >
        {{ question.confirm }}
      </button>
    </div>
  </dialog>
</template>
