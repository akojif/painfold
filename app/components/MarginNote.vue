<script setup lang="ts">
import { PII_TYPES, type PiiType } from '~~/core/pii-types'
import type { Finding } from '~~/core/review/review'
import type { CellSelection } from '~/utils/selection'

// docked: stays in view beside the rows while they scroll (desktop). On small
// screens it is always a bar fixed to the bottom.
const props = defineProps<{ finding?: Finding, marking?: CellSelection & { text: string }, problem?: string, docked?: boolean }>()
const emit = defineEmits<{ remove: [event: MouseEvent], keep: [], undo: [], startMark: [], confirmMark: [type: PiiType], cancelMark: [] }>()
const { review, revision } = useSession()
const { t } = useI18n()

// Names are the most likely miss in Stage 1, so they come first and are preselected.
const markTypes: PiiType[] = ['NAME', ...PII_TYPES.filter(type => type !== 'NAME')]
const markType = ref<PiiType>('NAME')
const markSelect = useTemplateRef<HTMLSelectElement>('markSelect')
watch(() => props.marking, async (marking) => {
  if (!marking) return
  markType.value = 'NAME'
  await nextTick()
  markSelect.value?.focus()
})

const decision = computed(() => (revision.value, props.finding ? review.value?.decisionFor(props.finding.key) : undefined))
const copyRows = computed(() => {
  const current = (revision.value, review.value)
  if (!props.finding || !current) return 0
  return new Set(current.copiesOf(props.finding.key).map(copy => copy.row)).size
})
const hasFindings = computed(() => (revision.value, (review.value?.findings.length ?? 0) > 0))
const canUndo = computed(() => (revision.value, review.value?.canUndo ?? false))
const copiesText = computed(() => {
  if (!props.finding || !review.value) return ''
  const placeholder = review.value.placeholderFor(props.finding)
  if (props.finding.formOf) return t('review.note.formOf', { marked: props.finding.formOf, placeholder })
  return t('review.note.copies', { n: copyRows.value, placeholder }, copyRows.value)
})
</script>

<template>
  <aside
    class="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-10 max-lg:border-t max-lg:border-line max-lg:bg-canvas max-lg:px-4 max-lg:py-4 max-lg:shadow-overlay"
    :class="{ 'lg:sticky lg:top-20': docked }"
    aria-labelledby="margin-note-title"
  >
    <form
      v-if="marking"
      class="space-y-3"
      @submit.prevent="emit('confirmMark', markType)"
    >
      <p
        id="margin-note-title"
        class="font-medium"
      >
        {{ $t('review.mark.heading', { text: marking.text }) }}
      </p>
      <label class="block text-sm">
        <span class="block text-fg-muted">{{ $t('review.mark.type') }}</span>
        <select
          ref="markSelect"
          v-model="markType"
          class="focus-ring mt-1 h-9 w-full rounded-md border border-line-strong bg-canvas px-2.5"
        >
          <option
            v-for="type in markTypes"
            :key="type"
            :value="type"
          >
            {{ $t(`typeOne.${type}`) }}
          </option>
        </select>
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          type="submit"
          class="focus-ring press h-9 rounded-md bg-fg px-3.5 font-medium text-canvas"
        >
          {{ $t('review.mark.confirm') }}
        </button>
        <button
          type="button"
          class="focus-ring press h-9 rounded-md border border-line px-3.5 hover:border-line-strong"
          @click="emit('cancelMark')"
        >
          {{ $t('review.mark.cancel') }}
        </button>
      </div>
    </form>

    <template v-else>
      <template v-if="finding">
        <p
          id="margin-note-title"
          class="text-sm text-fg-muted"
        >
          {{ $t('review.note.title', { type: $t(`typeOne.${finding.type}`), row: finding.row + 1 }) }}
        </p>
        <p class="mt-1 font-mono text-md wrap-anywhere max-lg:line-clamp-2">
          {{ finding.value }}
        </p>
        <p class="mt-1 text-sm text-fg-muted">
          {{ decision === 'remove' ? $t('review.note.removed') : decision === 'keep' ? $t('review.note.kept') : copiesText }}
        </p>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="focus-ring press flex h-9 items-center justify-center gap-2 rounded-md font-medium"
            :class="decision === 'remove' ? 'border border-line-strong text-fg' : 'bg-fg text-canvas'"
            :aria-pressed="decision === 'remove'"
            @click="emit('remove', $event)"
          >
            {{ $t('review.remove') }} <KeyCap>{{ SHORTCUTS.remove }}</KeyCap>
          </button>
          <button
            type="button"
            class="focus-ring press flex h-9 items-center justify-center gap-2 rounded-md border"
            :class="decision === 'keep' ? 'border-fg bg-fg font-medium text-canvas' : 'border-line hover:border-line-strong'"
            :aria-pressed="decision === 'keep'"
            @click="emit('keep')"
          >
            {{ $t('review.keep') }} <KeyCap>{{ SHORTCUTS.keep }}</KeyCap>
          </button>
        </div>
      </template>
      <p
        v-else-if="hasFindings"
        id="margin-note-title"
        class="text-sm text-fg-muted"
      >
        {{ $t('review.note.nothingSelected') }}
      </p>

      <p
        v-if="problem"
        role="alert"
        class="mt-3 text-sm text-danger"
      >
        {{ problem }}
      </p>

      <div class="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
        <button
          type="button"
          class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
          @click="emit('startMark')"
        >
          {{ $t('review.mark.button') }}
        </button>
        <button
          v-if="canUndo"
          type="button"
          class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
          @click="emit('undo')"
        >
          {{ $t('review.undo') }}
        </button>
      </div>

      <dl
        class="mt-4 space-y-1.5 text-xs text-fg-muted max-lg:hidden"
        :aria-label="$t('review.keys.label')"
      >
        <div class="flex items-center gap-2">
          <dt class="flex gap-1">
            <KeyCap>{{ SHORTCUTS.next }}</KeyCap><KeyCap>{{ SHORTCUTS.previous }}</KeyCap>
          </dt>
          <dd>{{ $t('review.keys.next') }}</dd>
        </div>
        <div class="flex items-center gap-2">
          <dt><KeyCap>{{ SHORTCUTS.mark }}</KeyCap></dt>
          <dd>{{ $t('review.keys.mark') }}</dd>
        </div>
        <div class="flex items-center gap-2">
          <dt><KeyCap>{{ SHORTCUTS.undo }}</KeyCap></dt>
          <dd>{{ $t('review.keys.undo') }}</dd>
        </div>
      </dl>
    </template>
  </aside>
</template>
