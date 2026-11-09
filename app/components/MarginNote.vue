<script setup lang="ts">
import { PII_TYPES, type PiiType } from '~~/core/pii-types'
import type { Finding } from '~~/core/review/review'
import type { CellSelection } from '~/utils/selection'

const props = defineProps<{ finding?: Finding, marking?: CellSelection & { text: string }, problem?: string }>()
const emit = defineEmits<{ remove: [], keep: [], undo: [], startMark: [], confirmMark: [type: PiiType], cancelMark: [] }>()
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
const canUndo = computed(() => (revision.value, review.value?.canUndo ?? false))
const copiesText = computed(() => props.finding && review.value
  ? t('review.note.copies', { n: copyRows.value, placeholder: review.value.placeholderFor(props.finding) }, copyRows.value)
  : '')
</script>

<template>
  <aside
    class="border-rule bg-desk max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-10 max-lg:border-t max-lg:px-4 max-lg:py-4 lg:sticky lg:top-6"
    aria-labelledby="margin-note-title"
  >
    <form
      v-if="marking"
      class="space-y-3"
      @submit.prevent="emit('confirmMark', markType)"
    >
      <p
        id="margin-note-title"
        class="font-semibold"
      >
        {{ $t('review.mark.heading', { text: marking.text }) }}
      </p>
      <label class="block text-sm">
        <span class="block text-ink-muted">{{ $t('review.mark.type') }}</span>
        <select
          ref="markSelect"
          v-model="markType"
          class="mt-1 w-full rounded-control border border-rule-strong bg-sheet px-3 py-1.5 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
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
          class="rounded-control bg-ink px-4 py-2 font-semibold text-desk outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {{ $t('review.mark.confirm') }}
        </button>
        <button
          type="button"
          class="rounded-control border border-rule-strong bg-sheet px-4 py-2 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
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
          class="text-sm text-ink-muted"
        >
          {{ $t('review.note.title', { type: $t(`typeOne.${finding.type}`), row: finding.row + 1 }) }}
        </p>
        <p class="mt-1 font-mono text-lg break-all">
          {{ finding.value }}
        </p>
        <p class="mt-1 text-sm text-ink-muted">
          {{ decision === 'remove' ? $t('review.note.removed') : decision === 'keep' ? $t('review.note.kept') : copiesText }}
        </p>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="flex items-center justify-center gap-3 rounded-control px-4 py-2.5 font-semibold outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
            :class="decision === 'remove' ? 'border border-ink bg-sheet text-ink' : 'bg-ink text-desk'"
            :aria-pressed="decision === 'remove'"
            @click="emit('remove')"
          >
            {{ $t('review.remove') }} <KeyCap>{{ SHORTCUTS.remove }}</KeyCap>
          </button>
          <button
            type="button"
            class="flex items-center justify-center gap-3 rounded-control border px-4 py-2.5 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
            :class="decision === 'keep' ? 'border-ink bg-ink font-semibold text-desk' : 'border-rule-strong bg-sheet text-ink'"
            :aria-pressed="decision === 'keep'"
            @click="emit('keep')"
          >
            {{ $t('review.keep') }} <KeyCap>{{ SHORTCUTS.keep }}</KeyCap>
          </button>
        </div>
      </template>
      <p
        v-else
        id="margin-note-title"
        class="text-sm text-ink-muted"
      >
        {{ $t('review.note.nothingSelected') }}
      </p>

      <p
        v-if="problem"
        role="alert"
        class="mt-3 border-l-4 border-alert pl-3 text-sm text-alert"
      >
        {{ problem }}
      </p>

      <div class="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-rule pt-4 text-sm">
        <button
          type="button"
          class="text-signal underline underline-offset-4 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="emit('startMark')"
        >
          {{ $t('review.mark.button') }}
        </button>
        <button
          v-if="canUndo"
          type="button"
          class="text-signal underline underline-offset-4 outline-signal focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="emit('undo')"
        >
          {{ $t('review.undo') }}
        </button>
      </div>

      <dl
        class="mt-4 space-y-1.5 text-sm text-ink-muted max-lg:hidden"
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
