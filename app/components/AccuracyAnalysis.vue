<script setup lang="ts">
// The analysis evaluation on the Accuracy page (#129): how well Painfold finds
// jobs, pains and gains, from the published test runs (app/utils/analysis-accuracy.ts).
// Before a test run is fully scored, it says so in one line. Follows the
// page's language switch; "both" adds the counts of both languages.
import { KINDS, type Kind } from '../../core/ai/merge'
import { ANTHROPIC_MODELS } from '../../core/ai/providers'
import type { Rate, Scores } from '../../scripts/analysis-metrics'

const props = defineProps<{ published: PublishedAnalysis, language: 'both' | AnalysisLang }>()
const { t, tm } = useI18n()
const { number, percent, list, date } = useFormat()

const runs = computed(() => (props.language === 'both' ? ANALYSIS_LANGS : [props.language]).flatMap(lang => props.published.runs[lang] ?? []))
const share = (rate: Rate) => (rate.of === 0 ? 0 : rate.hits / rate.of)
const added = (pick: (run: PublishedRun) => Rate) => addRates(runs.value.map(pick))

// The plain sentence: pains customers mention, matched to the right theme.
const painsFound = computed(() => Math.round(share(added(run => run.scores.tags.pains.recall)) * 100))
const texts = computed(() => runs.value.reduce((total, run) => total + run.texts, 0))
const perLanguage = computed(() => Math.min(...runs.value.map(run => run.texts)))
const models = computed(() => list([...new Set(runs.value.map(run => ANTHROPIC_MODELS.find(model => model.id === run.model)?.name ?? run.model))]))
const latest = computed(() => runs.value.map(run => run.createdAt).sort().at(-1) ?? '')
const people = computed(() => list([...new Set(runs.value.map(run => run.scores.mappedBy))]))

/** Rows for the table: found (recall) and correct (precision) per kind, as counts. */
const tableRows = (pick: (run: PublishedRun) => Record<Kind, Scores>) => KINDS.map((kind) => {
  const recall = added(run => pick(run)[kind].recall)
  const precision = added(run => pick(run)[kind].precision)
  return { type: kind, score: { labelled: recall.of, found: recall.hits, detected: precision.of, correct: precision.hits } }
})
const tagRows = computed(() => tableRows(run => run.scores.tags))
const presenceRows = computed(() => tableRows(run => run.scores.presence))
const tableShare = (counts: { labelled: number, found: number }) => (counts.labelled === 0 ? 0 : counts.found / counts.labelled)
const tablePrecision = (score: { detected: number, correct: number }) => (score.detected === 0 ? undefined : score.correct / score.detected)

const stable = computed(() => runs.value.every(run => props.published.stability[run.lang] !== undefined)
  ? addRates(runs.value.map(run => props.published.stability[run.lang]!))
  : undefined)
const singleRows = computed(() => [
  { key: 'sentiment', rate: added(run => run.scores.sentiment.correct) },
  { key: 'type', rate: added(run => run.scores.type.correct) },
  { key: 'quotes', rate: added(run => run.quotes) },
  ...(stable.value ? [{ key: 'stability', rate: stable.value }] : []),
])
const weaknesses = computed(() => (tm('accuracy.analysis.weaknesses.items') as unknown[]).length)
const missing = computed(() => (props.language === 'both' ? '' : t(`accuracy.languages.${props.language}`)))
</script>

<template>
  <section aria-labelledby="analysis">
    <h2
      id="analysis"
      class="text-md font-semibold"
    >
      {{ $t('accuracy.analysis.heading') }}
    </h2>
    <p
      v-if="runs.length === 0"
      class="mt-2 max-w-measure text-fg-muted"
    >
      {{ missing && Object.keys(published.runs).length > 0 ? $t('accuracy.analysis.notMeasuredLanguage', { language: missing }) : $t('accuracy.analysis.notMeasured') }}
    </p>
    <template v-else>
      <p class="mt-2 max-w-measure">
        {{ $t('accuracy.analysis.lead', { n: number(painsFound) }) }}
      </p>
      <div class="mt-2 max-w-measure space-y-2 text-sm text-fg-muted">
        <p>{{ $t('accuracy.analysis.measured', { texts: number(texts), model: models, date: date(latest), people }) }}</p>
        <p>{{ $t('accuracy.analysis.sample', { n: number(perLanguage), points: number(Math.round(100 / perLanguage)) }) }}</p>
      </div>

      <h3 class="mt-6 text-sm font-medium">
        {{ $t('accuracy.analysis.tags') }}
      </h3>
      <AccuracyTypeTable
        class="mt-2 table-fixed"
        labels="accuracy.analysis.kinds"
        head="accuracy.analysis.kind"
        count="accuracy.analysis.mentions"
        :rows="tagRows"
        :precision="tablePrecision"
        :share="tableShare"
      />
      <h3 class="mt-6 text-sm font-medium">
        {{ $t('accuracy.analysis.presence') }}
      </h3>
      <AccuracyTypeTable
        class="mt-2 table-fixed"
        labels="accuracy.analysis.kinds"
        head="accuracy.analysis.kind"
        count="accuracy.analysis.texts"
        :rows="presenceRows"
        :precision="tablePrecision"
        :share="tableShare"
      />
      <p class="mt-3 max-w-measure text-xs text-fg-muted">
        {{ $t('accuracy.analysis.explain') }}
      </p>

      <dl class="mt-6 space-y-3">
        <div
          v-for="row in singleRows"
          :key="row.key"
          class="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-4 gap-y-1 sm:grid-cols-[16rem_minmax(0,1fr)_3.5rem]"
        >
          <dt class="text-sm max-sm:col-span-2">
            {{ $t(`accuracy.analysis.single.${row.key}`) }}
          </dt>
          <AccuracyBar :value="share(row.rate)" />
          <dd class="text-right font-mono text-sm tabular-nums">
            {{ percent(share(row.rate)) }}
          </dd>
        </div>
      </dl>

      <template v-if="weaknesses > 0">
        <h3 class="mt-8 text-sm font-medium">
          {{ $t('accuracy.analysis.weaknesses.heading') }}
        </h3>
        <ul class="mt-2 max-w-measure list-disc space-y-1 pl-4 text-fg-muted marker:text-line-strong">
          <li
            v-for="index in weaknesses"
            :key="index"
          >
            {{ $t(`accuracy.analysis.weaknesses.items[${index - 1}]`) }}
          </li>
        </ul>
      </template>
      <p class="mt-6 max-w-measure text-sm text-fg-muted">
        {{ $t('accuracy.analysis.weaknesses.next') }}
      </p>
    </template>
  </section>
</template>
