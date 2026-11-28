<script setup lang="ts">
// "Try an example" (#130): one choice between cleaning the made-up sample file
// step by step and seeing the finished demo analysis of it. A native modal
// dialog: focus stays inside, Escape closes it, and the rest of the page is
// inert; Cancel, Escape or a click outside close it. The two options are a radio group (arrow keys move between them);
// the button names what happens next. It enters like the other dialogs (overlay-in).
const emit = defineEmits<{ sample: [], demo: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const choice = ref<'sample' | 'demo'>('sample')

function open() {
  choice.value = 'sample'
  dialog.value?.showModal()
  dialog.value?.querySelector('input')?.focus()
}
function close() {
  dialog.value?.close()
}
function proceed() {
  close()
  if (choice.value === 'sample') emit('sample')
  else emit('demo')
}
defineExpose({ open })

const OPTIONS = ['sample', 'demo'] as const
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="example-title"
    aria-describedby="example-body"
    class="m-auto w-[calc(100%-2rem)] max-w-md rounded-md border border-line bg-canvas p-0 text-fg shadow-overlay backdrop:bg-fg/20 open:animate-overlay-in"
    @click.self="close"
  >
    <form
      class="p-5"
      @submit.prevent="proceed"
    >
      <h2
        id="example-title"
        class="text-md font-semibold"
      >
        {{ $t('start.example.title') }}
      </h2>
      <p
        id="example-body"
        class="mt-1 text-sm text-fg-muted"
      >
        {{ $t('start.example.body') }}
      </p>

      <fieldset class="mt-5 grid gap-2">
        <legend class="sr-only">
          {{ $t('start.example.title') }}
        </legend>
        <label
          v-for="option in OPTIONS"
          :key="option"
          class="flex cursor-pointer gap-3 rounded-md border px-4 py-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          :class="choice === option ? 'border-line-strong bg-surface' : 'border-line hover:border-line-strong'"
        >
          <input
            v-model="choice"
            type="radio"
            name="example"
            :value="option"
            class="mt-1 size-4 shrink-0 accent-fg"
            :aria-describedby="`example-${option}`"
          >
          <span>
            <span class="block font-medium">{{ $t(`start.example.${option}.title`) }}</span>
            <span
              :id="`example-${option}`"
              class="mt-0.5 block text-sm text-fg-muted"
            >{{ $t(`start.example.${option}.body`) }}</span>
          </span>
        </label>
      </fieldset>

      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="press focus-ring h-9 rounded-md border border-line px-3.5 hover:border-line-strong"
          @click="close"
        >
          {{ $t('start.example.cancel') }}
        </button>
        <button
          type="submit"
          class="press focus-ring h-9 rounded-md bg-fg px-3.5 font-medium text-canvas hover:opacity-90"
        >
          {{ choice === 'sample' ? $t('start.example.openSample') : $t('start.example.showDemo') }}
        </button>
      </div>
    </form>
  </dialog>
</template>
