<script setup lang="ts">
import type { PiiType } from '~~/core/pii-types'
import type { Warning } from '~~/core/review/review'
import type { ValueEntry, ValueGroup } from '~/utils/value-list'

const props = defineProps<{ groups: ValueGroup[], warnings: readonly Warning[], selectedKey?: string, selectedWarningKey?: string, motions: ReadonlyMap<string, RemovalMotion> }>()
const emit = defineEmits<{ select: [id: number], removeType: [type: PiiType], showMore: [type: PiiType], selectWarning: [key: string], removeWarnings: [] }>()
const { t } = useI18n()
const { number } = useFormat()
const { review, revision } = useSession()

// Read the revision so decisions re-render the list.
const decisionFor = (key: string) => (revision.value, review.value?.decisionFor(key))
const warningDecisionFor = (key: string) => (revision.value, review.value?.warningDecisionFor(key))
const openWarnings = computed(() => (revision.value, props.warnings.filter(warning => !review.value?.warningDecisionFor(warning.key)).length))
const warningLabel = (warning: Warning) => t('warning.valueLabel', {
  kind: t(`warning.kind.${warning.reason}`),
  row: warning.row + 1,
  state: t(`warning.state.${warningDecisionFor(warning.key) ?? 'pending'}`),
  text: warningDecisionFor(warning.key) === 'remove' ? review.value!.placeholderForWarning(warning) : warning.value,
})
const label = (entry: ValueEntry) => t('review.valueLabel', {
  type: t(`typeOne.${entry.type}`),
  state: t(`review.state.${decisionFor(entry.key) ?? 'pending'}`),
  text: decisionFor(entry.key) === 'remove' ? review.value!.placeholderFor(entry.finding) : entry.finding.value,
})
</script>

<template>
  <nav :aria-label="$t('review.valuesLabel')">
    <section
      v-for="group in groups"
      :key="group.type"
      :aria-labelledby="`values-${group.type}`"
    >
      <div class="sticky top-0 z-[1] flex min-h-9 items-center justify-between gap-3 border-b border-line bg-surface px-3">
        <h2
          :id="`values-${group.type}`"
          class="text-xs font-medium text-fg-muted"
        >
          {{ $t(`typeMany.${group.type}`) }}
        </h2>
        <button
          v-if="group.pending > 0"
          type="button"
          class="focus-ring rounded-sm text-xs text-accent underline-offset-4 hover:underline"
          :aria-label="$t('review.removeAllOfType', { n: number(group.pending), one: $t(`typeOneLower.${group.type}`), many: $t(`typeManyLower.${group.type}`) }, group.pending)"
          @click="emit('removeType', group.type)"
        >
          {{ $t('review.removeAllShort', { n: number(group.pending) }, group.pending) }}
        </button>
      </div>
      <ul class="p-1">
        <li
          v-for="entry in group.values"
          :key="entry.key"
        >
          <button
            type="button"
            :data-value="entry.finding.id"
            :aria-label="label(entry)"
            :aria-current="entry.key === selectedKey ? 'true' : undefined"
            class="focus-ring flex min-h-8 w-full items-center justify-between gap-3 rounded-sm px-2 py-1 text-left"
            :class="entry.key === selectedKey ? 'bg-canvas shadow-raised' : 'hover:bg-canvas/70'"
            @click="emit('select', entry.finding.id)"
          >
            <RedactionToken
              v-if="decisionFor(entry.key) === 'remove'"
              :placeholder="review!.placeholderFor(entry.finding)"
              :motion="motions.get(entry.key)"
            />
            <!-- Links differ at the end, so they are cut in the middle; other values at the end. -->
            <span
              v-else
              class="flex min-w-0 font-mono text-sm"
              :class="decisionFor(entry.key) === 'keep'
                ? 'text-fg-muted underline decoration-line-strong decoration-dotted underline-offset-4'
                : 'rounded-sm bg-pending px-1 text-on-pending underline decoration-pending-line underline-offset-4'"
            >
              <MiddleTruncate
                v-if="entry.type === 'URL'"
                :text="entry.finding.value"
                :tail="16"
              />
              <span
                v-else
                class="truncate"
              >{{ entry.finding.value }}</span>
            </span>
            <span class="flex shrink-0 items-center gap-2 text-xs text-fg-muted">
              <span v-if="decisionFor(entry.key) === 'keep'">{{ $t('review.keptTag') }}</span>
              <span class="font-mono tabular-nums">{{ number(entry.rows) }}</span>
            </span>
          </button>
        </li>
        <li v-if="group.more > 0">
          <button
            type="button"
            class="focus-ring rounded-sm px-2 py-1 text-sm text-accent underline-offset-4 hover:underline"
            @click="emit('showMore', group.type)"
          >
            {{ $t('review.showMoreOfType', { n: number(group.more) }) }}
          </button>
        </li>
      </ul>
    </section>

    <!-- Warnings come last: they are kept unless removed, so they never hold up the review. One entry per warning, since each is decided where it is. -->
    <section
      v-if="warnings.length > 0"
      aria-labelledby="values-warnings"
    >
      <div class="sticky top-0 z-[1] flex min-h-9 items-center justify-between gap-3 border-b border-line bg-surface px-3">
        <h2
          id="values-warnings"
          class="text-xs font-medium text-fg-muted"
        >
          {{ $t('warning.heading') }}
        </h2>
        <button
          v-if="openWarnings > 0"
          type="button"
          class="focus-ring rounded-sm text-xs text-accent underline-offset-4 hover:underline"
          :aria-label="$t('warning.removeAllLabel', { n: number(openWarnings) }, openWarnings)"
          @click="emit('removeWarnings')"
        >
          {{ $t('review.removeAllShort', { n: number(openWarnings) }, openWarnings) }}
        </button>
      </div>
      <ul class="p-1">
        <li
          v-for="warning in warnings"
          :key="warning.key"
        >
          <button
            type="button"
            :data-warning-value="warning.key"
            :aria-label="warningLabel(warning)"
            :aria-current="warning.key === selectedWarningKey ? 'true' : undefined"
            class="focus-ring flex min-h-8 w-full items-center justify-between gap-3 rounded-sm px-2 py-1 text-left"
            :class="warning.key === selectedWarningKey ? 'bg-canvas shadow-raised' : 'hover:bg-canvas/70'"
            @click="emit('selectWarning', warning.key)"
          >
            <RedactionToken
              v-if="warningDecisionFor(warning.key) === 'remove'"
              :placeholder="review!.placeholderForWarning(warning)"
              :motion="motions.get(warning.key)"
            />
            <span
              v-else
              class="min-w-0 truncate font-mono text-sm underline decoration-1 underline-offset-4"
              :class="warningDecisionFor(warning.key) === 'dismiss' ? 'text-fg-muted decoration-line-strong decoration-dotted' : 'decoration-danger decoration-dashed'"
            >{{ warning.value }}</span>
            <span class="flex shrink-0 items-center gap-2 text-xs text-fg-muted">
              <span v-if="warningDecisionFor(warning.key) === 'dismiss'">{{ $t('review.keptTag') }}</span>
              <span>{{ $t(`warning.short.${warning.reason}`) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  </nav>
</template>
