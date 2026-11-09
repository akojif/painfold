<script setup lang="ts">
import type { PiiType } from '~~/core/pii-types'
import type { ValueEntry, ValueGroup } from '~/utils/value-list'

defineProps<{ groups: ValueGroup[], selectedKey?: string, motions: ReadonlyMap<string, RemovalMotion> }>()
const emit = defineEmits<{ select: [id: number], removeType: [type: PiiType] }>()
const { t } = useI18n()
const { number } = useFormat()
const { review, revision } = useSession()

// Read the revision so decisions re-render the list.
const decisionFor = (key: string) => (revision.value, review.value?.decisionFor(key))
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
          :aria-label="$t('review.removeAllOfType', { n: number(group.pending), type: $t(`typeManyLower.${group.type}`) })"
          @click="emit('removeType', group.type)"
        >
          {{ $t('review.removeAllShort', { n: number(group.pending) }) }}
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
            <span
              v-else
              class="min-w-0 truncate font-mono text-sm"
              :class="decisionFor(entry.key) === 'keep'
                ? 'text-fg-muted underline decoration-line-strong decoration-dotted underline-offset-4'
                : 'rounded-sm bg-pending px-1 text-on-pending underline decoration-pending-line underline-offset-4'"
            >{{ entry.finding.value }}</span>
            <span class="flex shrink-0 items-center gap-2 text-xs text-fg-muted">
              <span v-if="decisionFor(entry.key) === 'keep'">{{ $t('review.keptTag') }}</span>
              <span class="font-mono tabular-nums">{{ number(entry.rows) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  </nav>
</template>
