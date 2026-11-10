<script setup lang="ts">
// One quiet line about names in the review (and the download step): how many
// rows are checked while names arrive, with Stop; what was found once done;
// and what was skipped. Stop asks first, because names that are not found are
// not removed from the download. Screen readers hear the start and the end,
// not every batch.
const { t } = useI18n()
const { number } = useFormat()
const { status, done, total, found, run, skip } = useNameScan()
const { status: modelStatus } = useNameModel()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const announcement = ref('')

// While the model is missing or on its way, the download line above says so.
const visible = computed(() => status.value === 'running' || status.value === 'done' || status.value === 'failed' || (status.value === 'skipped' && modelStatus.value === 'ready'))
const counts = computed(() => ({
  names: t('nameScan.names', { n: number(found.value.names) }, found.value.names),
  places: t('nameScan.places', { n: number(found.value.places) }, found.value.places),
}))

watch(status, (now) => {
  announcement.value = now === 'running' ? t('nameScan.announce.started') : now === 'done' ? t('nameScan.announce.done', counts.value) : ''
})

function confirmSkip() {
  dialog.value?.close()
  // The check may have finished while the question was open.
  if (status.value === 'running') skip()
}
</script>

<template>
  <div class="text-sm">
    <template v-if="visible">
      <div
        v-if="status === 'running'"
        class="flex flex-wrap items-baseline gap-x-4 gap-y-1"
      >
        <p class="text-fg-muted tabular-nums">
          {{ $t('nameScan.running', { done: number(done), total: number(total) }) }}
        </p>
        <button
          type="button"
          class="press focus-ring rounded-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          aria-haspopup="dialog"
          @click="dialog?.showModal()"
        >
          {{ $t('nameScan.stop') }}
        </button>
      </div>

      <p
        v-else-if="status === 'done'"
        class="text-fg-muted"
      >
        {{ $t('nameScan.done') }}
      </p>

      <div
        v-else
        class="flex flex-wrap items-baseline gap-x-4 gap-y-1"
      >
        <p :class="status === 'failed' ? 'text-danger' : 'text-fg-muted'">
          {{ status === 'failed' ? $t('nameScan.failed') : done > 0 ? $t('nameScan.skipped', { done: number(done), total: number(total) }) : $t('nameScan.skippedNone') }}
        </p>
        <button
          type="button"
          class="press focus-ring rounded-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
          @click="run"
        >
          {{ $t(status === 'failed' ? 'nameScan.retry' : 'nameScan.checkAnyway') }}
        </button>
      </div>
    </template>

    <dialog
      ref="dialog"
      aria-labelledby="skip-names-title"
      aria-describedby="skip-names-body"
      class="m-auto w-full max-w-sm rounded-md border border-line bg-canvas p-0 text-fg shadow-overlay backdrop:bg-fg/20 open:animate-overlay-in"
      @click.self="dialog?.close()"
    >
      <div class="space-y-2 px-5 pt-5">
        <h2
          id="skip-names-title"
          class="text-md font-semibold"
        >
          {{ $t('nameScan.confirm.title') }}
        </h2>
        <p
          id="skip-names-body"
          class="text-sm text-fg-muted"
        >
          {{ $t('nameScan.confirm.body') }}
        </p>
      </div>
      <div class="flex justify-end gap-2 px-5 py-4">
        <button
          type="button"
          class="press focus-ring h-9 rounded-md border border-line px-3.5 hover:border-line-strong"
          autofocus
          @click="dialog?.close()"
        >
          {{ $t('nameScan.confirm.keep') }}
        </button>
        <button
          type="button"
          class="press focus-ring h-9 rounded-md bg-fg px-3.5 font-medium text-canvas hover:opacity-90"
          @click="confirmSkip"
        >
          {{ $t('nameScan.confirm.skip') }}
        </button>
      </div>
    </dialog>

    <p
      class="sr-only"
      aria-live="polite"
    >
      {{ announcement }}
    </p>
  </div>
</template>
