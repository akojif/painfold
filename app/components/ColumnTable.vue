<script setup lang="ts">
import { personalKind } from '~~/core/columns/roles'
import type { ColumnCounts } from '~~/core/detect/table'
import { PII_TYPES } from '~~/core/pii-types'

// Every column of the file with what happens to it. counts: how much personal
// data each column holds, from the survey in the worker; undefined until known.
const props = defineProps<{ counts?: readonly ColumnCounts[] }>()
const { t } = useI18n()
const { number, list } = useFormat()
const session = useSession()
const { table, suggestions, roles, feedbackColumn } = session

const SAMPLES = 3
const SAMPLE_LENGTH = 120
// The same number of dots for every value, so a dropped value's length stays hidden.
const MASK = '••••••'
// Links differ at the end, so their samples are cut in the middle.
const LINK = /^https?:\/\//i

/** A column name split after _ - . and /, so a long name wraps there rather than mid-word. */
const breakable = (name: string) => name.split(/(?<=[_\-./])/)

// Feedback column first, then columns that look personal, then the rest. The
// order is fixed when the file loads, so choosing another feedback column
// marks it in place instead of moving rows away from the pointer.
const order = ref<number[]>([])
watch(table, (current) => {
  if (!current) return
  const rank = (index: number) => (index === feedbackColumn.value ? 0 : suggestions.value[index]?.reason === 'personal-header' ? 1 : 2)
  order.value = current.columns.map((_, index) => index).sort((a, b) => rank(a) - rank(b))
}, { immediate: true })

const samples = computed(() => table.value?.columns.map((_, index) => {
  const distinct = new Set<string>()
  for (const row of table.value!.rows) {
    const value = row[index]?.trim()
    if (value) distinct.add(value.slice(0, SAMPLE_LENGTH))
    if (distinct.size === SAMPLES) break
  }
  return [...distinct]
}) ?? [])

// Only a column with words in it can hold feedback.
const canBeFeedback = computed(() => table.value?.columns.map((_, index) => table.value!.rows.some(row => /\p{L}/u.test(row[index] ?? ''))) ?? [])

/** The reason shown under a column whose role was set automatically and not changed. */
function reason(index: number): string | undefined {
  const suggestion = suggestions.value[index]
  if (!suggestion || index === feedbackColumn.value || roles.value[index] !== suggestion.role) return undefined
  if (suggestion.reason === 'personal-header') return t(`columns.reason.${personalKind(table.value!.columns[index]!)}`)
  if (suggestion.reason === 'no-text') return t('columns.reason.noText')
  return undefined
}

/** "34 email addresses and 2 phone numbers" for a column kept as is that holds personal data. */
function warning(index: number): string | undefined {
  if (roles.value[index] !== 'keep' || suggestions.value[index]?.reason === 'empty') return undefined
  const counts = props.counts?.find(entry => entry.column === index)?.counts
  if (!counts) return undefined
  const parts = PII_TYPES.flatMap((type) => {
    const n = counts[type] ?? 0
    return n > 0 ? [`${number(n)} ${t(n === 1 ? `typeOneLower.${type}` : `typeManyLower.${type}`)}`] : []
  })
  if (parts.length === 0) return undefined
  return t('columns.warning', { found: list(parts) })
}

async function checkInstead(index: number) {
  roles.value[index] = 'scan'
  await nextTick()
  document.querySelector<HTMLInputElement>(`input[name="role-${index}"][value="scan"]`)?.focus()
}
</script>

<template>
  <section
    v-if="table"
    :aria-label="$t('columns.listLabel')"
  >
    <p
      v-if="feedbackColumn === undefined"
      class="mb-4 text-sm"
    >
      {{ $t('columns.noFeedback') }}
    </p>
    <div
      aria-hidden="true"
      class="grid grid-cols-[1.5rem_11rem_minmax(0,1fr)_15.5rem] gap-x-4 border-b border-line px-3 pb-2 text-xs text-fg-muted max-md:hidden"
    >
      <span />
      <span>{{ $t('columns.headers.column') }}</span>
      <span>{{ $t('columns.headers.samples') }}</span>
      <span>{{ $t('columns.headers.choice') }}</span>
    </div>
    <ul class="divide-y divide-line">
      <li
        v-for="index in order"
        :key="index"
        class="group grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 gap-y-1.5 px-3 py-3 md:grid-cols-[1.5rem_11rem_minmax(0,1fr)_15.5rem] md:items-center"
      >
        <span class="grid size-6 place-items-center">
          <input
            v-if="canBeFeedback[index]"
            type="radio"
            name="feedback-column"
            class="focus-ring size-4 cursor-pointer accent-accent"
            :class="{ 'pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100': feedbackColumn !== undefined && index !== feedbackColumn }"
            :value="index"
            :checked="index === feedbackColumn"
            :aria-label="$t('columns.useAsFeedback', { column: table.columns[index] })"
            @change="session.setFeedbackColumn(index)"
          >
        </span>

        <div class="min-w-0">
          <p class="font-medium wrap-anywhere">
            <template
              v-for="(part, at) in breakable(table.columns[index]!)"
              :key="at"
            >
              <wbr v-if="at > 0">{{ part }}
            </template>
          </p>
          <p
            v-if="reason(index)"
            class="text-xs text-fg-muted"
          >
            {{ reason(index) }}
          </p>
        </div>

        <div class="min-w-0 max-md:col-start-2">
          <p
            v-if="suggestions[index]?.reason === 'empty'"
            class="text-sm text-fg-muted"
          >
            {{ $t('columns.empty') }}
          </p>
          <p
            v-else-if="roles[index] === 'drop'"
            class="flex gap-3 font-mono text-xs text-fg-muted"
          >
            <span class="sr-only">{{ $t('columns.masked') }}</span>
            <span
              v-for="(_, sample) in samples[index]"
              :key="sample"
              aria-hidden="true"
            >{{ MASK }}</span>
          </p>
          <ul
            v-else
            class="flex min-w-0 gap-3 font-mono text-xs text-fg-muted"
          >
            <li
              v-for="sample in samples[index]"
              :key="sample"
              class="flex max-w-[24ch] min-w-0"
            >
              <MiddleTruncate
                v-if="LINK.test(sample)"
                :text="sample"
              />
              <span
                v-else
                class="truncate"
                :title="sample"
              >{{ sample }}</span>
            </li>
          </ul>
        </div>

        <div class="max-md:col-start-2">
          <p
            v-if="index === feedbackColumn"
            class="text-sm text-fg-muted"
          >
            {{ $t('columns.isFeedback') }}
          </p>
          <RoleControl
            v-else
            v-model="roles[index]!"
            :column="table.columns[index]!"
            :name="`role-${index}`"
          />
        </div>

        <p
          v-if="warning(index)"
          class="col-[2/-1] flex flex-wrap items-baseline gap-x-2 text-sm"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            class="size-3.5 shrink-0 translate-y-0.5 fill-none stroke-danger stroke-[1.6]"
          ><path d="M8 2.5 14 13H2zM8 6.5v3M8 11.2v.1" /></svg>
          <span>{{ warning(index) }}</span>
          <button
            type="button"
            class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
            @click="checkInstead(index)"
          >
            {{ $t('columns.checkInstead') }}
          </button>
        </p>
      </li>
    </ul>
  </section>
</template>
