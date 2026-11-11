<script setup lang="ts">
// The friendly note a phone gets when it reaches for a file: Painfold likes a
// bigger screen. Copy link puts the address on the clipboard (or shows it to
// copy by hand where the browser does not allow that); Continue anyway runs
// the action that was tapped, now and for the rest of the visit. A native
// modal dialog: focus stays inside, Escape closes it. It slides up from the
// bottom in 220 ms with transform and opacity; with reduced motion it simply
// appears.
const emit = defineEmits<{ continue: [] }>()
const { t } = useI18n()
const localePath = useLocalePath()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const shown = ref(false)
const copied = ref<'yes' | 'manual'>()
const link = computed(() => (import.meta.client ? new URL(localePath('/'), location.origin).href : ''))

function open() {
  copied.value = undefined
  dialog.value?.showModal()
  requestAnimationFrame(() => requestAnimationFrame(() => (shown.value = true)))
}
function close() {
  shown.value = false
  dialog.value?.close()
}
defineExpose({ open })

async function copy() {
  try {
    await navigator.clipboard.writeText(link.value)
    copied.value = 'yes'
  }
  catch {
    copied.value = 'manual'
  }
}

function continueAnyway() {
  close()
  emit('continue')
}
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="small-screen-title"
    aria-describedby="small-screen-body"
    class="m-0 mt-auto w-full max-w-none rounded-t-md border-t border-line bg-canvas p-0 text-fg shadow-overlay backdrop:bg-fg/20 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
    :class="shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
    @close="shown = false"
    @click.self="close"
  >
    <div class="mx-auto max-w-md px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <h2
        id="small-screen-title"
        class="text-lg font-semibold"
      >
        {{ $t('smallScreen.title') }}
      </h2>
      <p
        id="small-screen-body"
        class="mt-2 text-fg-muted"
      >
        {{ $t('smallScreen.body') }}
      </p>
      <p
        v-if="copied === 'manual'"
        class="mt-3 rounded-sm border border-line bg-surface px-2 py-1.5 font-mono text-sm break-all select-all"
      >
        {{ link }}
      </p>
      <div class="mt-5 grid gap-2">
        <button
          type="button"
          class="press focus-ring h-11 rounded-md bg-fg px-4 font-medium text-canvas hover:opacity-90"
          autofocus
          @click="copy"
        >
          {{ copied === 'yes' ? $t('smallScreen.copied') : $t('smallScreen.copy') }}
        </button>
        <button
          type="button"
          class="press focus-ring h-11 rounded-md border border-line px-4 hover:border-line-strong"
          @click="continueAnyway"
        >
          {{ $t('smallScreen.continue') }}
        </button>
      </div>
      <p
        class="sr-only"
        aria-live="polite"
      >
        {{ copied === 'yes' ? t('smallScreen.copied') : copied === 'manual' ? t('smallScreen.copyManually') : '' }}
      </p>
    </div>
  </dialog>
</template>
