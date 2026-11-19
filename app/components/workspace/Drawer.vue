<script setup lang="ts">
// The detail panel for the selected row. From 1,280 px it is docked: a
// column beside the table, so the keyboard keeps moving through the rows.
// Below that it floats over the table's right side, so the table keeps its
// width. Escape closes it.
const props = defineProps<{ open: boolean, title: string, sub?: string }>()
const emit = defineEmits<{ close: [] }>()
const headingId = useId()

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !props.open || event.defaultPrevented) return
  emit('close')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Transition
    enter-active-class="transition-[transform,opacity] duration-[240ms] ease-out motion-reduce:transition-none"
    enter-from-class="translate-x-3 opacity-0"
    leave-active-class="transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none"
    leave-to-class="translate-x-3 opacity-0"
  >
    <section
      v-if="open"
      :aria-labelledby="headingId"
      class="fixed top-14 right-0 bottom-0 z-20 w-96 max-w-[calc(100vw-2rem)] overflow-y-auto border-l border-raised-line bg-raised shadow-overlay xl:sticky xl:z-auto xl:h-[calc(100dvh-3.5rem)] xl:w-auto xl:max-w-none xl:border-line xl:bg-surface xl:shadow-none"
    >
      <div class="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div class="min-w-0">
          <h2
            :id="headingId"
            class="text-md font-semibold text-pretty wrap-anywhere"
          >
            {{ title }}
          </h2>
          <p
            v-if="sub"
            class="text-sm text-fg-muted"
          >
            {{ sub }}
          </p>
        </div>
        <button
          type="button"
          class="focus-ring press -mr-1.5 grid size-8 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-tint hover:text-fg"
          :aria-label="$t('workspace.drawer.close')"
          :title="$t('workspace.drawer.closeTitle')"
          @click="emit('close')"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            class="size-4 fill-none stroke-current stroke-[1.5]"
          ><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
      <div class="px-5 py-4">
        <slot />
      </div>
    </section>
  </Transition>
</template>
