<script setup lang="ts">
const emit = defineEmits<{ file: [file: File] }>()
const input = useTemplateRef<HTMLInputElement>('input')
const dragging = ref(false)

function choose(files: FileList | null | undefined) {
  dragging.value = false
  const file = files?.[0]
  if (file) emit('file', file)
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  choose(target.files)
  target.value = ''
}

defineExpose({ open: () => input.value?.click() })
</script>

<template>
  <div
    class="rounded-control border-2 border-dashed px-6 py-10 text-center"
    :class="dragging ? 'border-signal bg-sheet' : 'border-rule-strong'"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="choose($event.dataTransfer?.files)"
  >
    <p v-if="dragging">
      {{ $t('start.dropActive') }}
    </p>
    <p v-else>
      {{ $t('start.drop') }}
      <button
        type="button"
        class="rounded-control border border-rule-strong bg-sheet px-3 py-1.5 font-semibold outline-signal hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2"
        @click="input?.click()"
      >
        {{ $t('start.choose') }}
      </button>
    </p>
    <input
      ref="input"
      type="file"
      accept=".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      class="hidden"
      data-testid="file-input"
      @change="onChange"
    >
  </div>
</template>
