<script setup lang="ts">
// How well Painfold finds personal data, from the same eval output as
// docs/accuracy.md (data/eval/accuracy.json, written by `npm run eval --
// --write` and checked by a unit test). Findings first, then the evidence,
// with plain numbers and simple bars. Prerendered: nothing is loaded.
import accuracy from '~~/data/eval/accuracy.json'
import type { AccuracyData } from '~~/scripts/eval'

const data = accuracy as AccuracyData
const { t } = useI18n()
const { number, percent } = useFormat()
useHead({ title: () => `${t('accuracy.title')}, ${t('app.name')}` })

type Lang = 'de' | 'en'
type Counts = { labelled: number, found: number }
type Score = Counts & { detected: number, correct: number }
const language = ref<'both' | Lang>('both')
const languages = ['both', 'de', 'en'] as const

/** Counts for the chosen language, or both added up. */
function pick<T extends Counts>(byLang: Record<Lang, T>): T {
  if (language.value !== 'both') return byLang[language.value]
  const keys = Object.keys(byLang.de) as Array<keyof T>
  return Object.fromEntries(keys.map(key => [key, (byLang.de[key] as number) + (byLang.en[key] as number)])) as T
}
const share = (counts: Counts) => (counts.labelled === 0 ? 0 : counts.found / counts.labelled)
const both = (byLang: Record<Lang, Counts>) => ({ labelled: byLang.de.labelled + byLang.en.labelled, found: byLang.de.found + byLang.en.found })
const sum = (all: Counts[]) => all.reduce((total, counts) => ({ labelled: total.labelled + counts.labelled, found: total.found + counts.found }), { labelled: 0, found: 0 })

const { names } = data
// The headline numbers are always for both languages.
const removedOverall = share(sum(names.groups.map(group => both(names.removal[group]!))))
const weakest = Math.min(...names.groups.map(group => share(both(names.removal[group]!))))
const targetMet = weakest >= data.target
const hardCases = share(both(data.sets['hard-cases'].any))

const namesTotal = computed(() => ({
  removal: sum(names.groups.map(group => pick(names.removal[group]!))),
  typeCorrect: sum(names.groups.map(group => pick(names.typeCorrect[group]!))),
  withoutList: sum(names.groups.map(group => pick(names.withoutList[group]!))),
}))
const nameRows = computed(() => [
  { key: 'removal', counts: namesTotal.value.removal },
  { key: 'typeCorrect', counts: namesTotal.value.typeCorrect },
  { key: 'withoutList', counts: namesTotal.value.withoutList },
] as const)
const groupRows = computed(() => names.groups.map(group => ({
  group,
  removal: pick(names.removal[group]!),
  typeCorrect: pick(names.typeCorrect[group]!),
  withoutList: pick(names.withoutList[group]!),
})))

/** Rows for a set's table: every kind of data it has values for, names and places included. */
function typeRows(set: 'hard-cases' | 'generated') {
  return Object.entries(data.sets[set].types)
    .map(([type, byLang]) => ({ type, score: pick(byLang as Record<Lang, Score>) }))
    .filter(row => row.score.labelled > 0)
}
const precision = (score: Score) => (score.detected === 0 ? undefined : score.correct / score.detected)

const GITHUB = 'https://github.com/akojif/painfold/blob/main'
</script>

<template>
  <article class="max-w-3xl">
    <h1 class="text-xl font-semibold text-balance sm:text-2xl">
      {{ $t('accuracy.heading') }}
    </h1>
    <p class="mt-4 max-w-measure text-md">
      {{ $t('accuracy.lead', { n: number(Math.round(removedOverall * 100)) }) }}
    </p>

    <section
      class="mt-8 border-t border-line pt-6"
      :aria-label="$t('accuracy.findingsLabel')"
    >
      <ul class="max-w-measure space-y-3">
        <li>{{ $t('accuracy.findings.names', { removal: percent(removedOverall), min: percent(weakest), groups: number(names.groups.length) }) }}</li>
        <li>{{ $t('accuracy.findings.rules', { removal: percent(hardCases) }) }}</li>
        <li :class="targetMet ? 'text-fg' : 'text-danger'">
          {{ $t(targetMet ? 'accuracy.findings.targetMet' : 'accuracy.findings.targetMissed', { target: percent(data.target) }) }}
        </li>
      </ul>
    </section>

    <section
      class="mt-10"
      aria-labelledby="measured"
    >
      <h2
        id="measured"
        class="text-md font-semibold"
      >
        {{ $t('accuracy.measured.heading') }}
      </h2>
      <div class="mt-2 max-w-measure space-y-2 text-fg-muted">
        <p>{{ $t('accuracy.measured.sets') }}</p>
        <p>{{ $t('accuracy.measured.browser') }}</p>
        <p>{{ $t('accuracy.measured.terms') }}</p>
      </div>
    </section>

    <div class="sticky top-14 z-10 mt-10 -mx-4 border-b border-line bg-canvas px-4 py-3 sm:mx-0 sm:px-0">
      <fieldset class="inline-flex rounded-md border border-line bg-surface p-0.5">
        <legend class="sr-only">
          {{ $t('accuracy.language') }}
        </legend>
        <label
          v-for="option in languages"
          :key="option"
          class="press cursor-pointer rounded-sm px-2.5 py-1 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent"
          :class="language === option ? 'bg-canvas font-medium text-fg shadow-raised' : 'text-fg-muted hover:text-fg'"
        >
          <input
            v-model="language"
            type="radio"
            name="accuracy-language"
            :value="option"
            class="sr-only"
          >
          {{ $t(`accuracy.languages.${option}`) }}
        </label>
      </fieldset>
    </div>

    <section
      class="mt-8"
      aria-labelledby="names"
    >
      <h2
        id="names"
        class="text-md font-semibold"
      >
        {{ $t('accuracy.names.heading') }}
      </h2>
      <p class="mt-1 text-sm text-fg-muted">
        {{ $t('accuracy.names.count', { n: number(namesTotal.removal.labelled) }) }}
      </p>
      <dl class="mt-4 space-y-3">
        <div
          v-for="row in nameRows"
          :key="row.key"
          class="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-4 gap-y-1 sm:grid-cols-[16rem_minmax(0,1fr)_3.5rem]"
        >
          <dt class="text-sm max-sm:col-span-2">
            {{ $t(`accuracy.names.${row.key}`) }}
          </dt>
          <AccuracyBar
            :value="share(row.counts)"
            :target="row.key === 'removal' ? data.target : undefined"
          />
          <dd class="text-right font-mono text-sm tabular-nums">
            {{ percent(share(row.counts)) }}
          </dd>
        </div>
      </dl>
      <p class="mt-4 max-w-measure text-sm text-fg-muted">
        {{ $t('accuracy.names.list', { onList: number(names.onList), total: number(names.total) }) }}
      </p>
    </section>

    <section
      class="mt-10"
      aria-labelledby="groups"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2
          id="groups"
          class="text-md font-semibold"
        >
          {{ $t('accuracy.groups.heading') }}
        </h2>
        <p class="text-xs text-fg-muted">
          {{ $t('accuracy.groups.target', { target: percent(data.target) }) }}
        </p>
      </div>
      <p class="mt-1 max-w-measure text-sm text-fg-muted">
        {{ $t('accuracy.groups.note') }}
      </p>
      <p
        v-if="language !== 'both'"
        class="mt-1 max-w-measure text-sm text-fg-muted"
      >
        {{ $t('accuracy.groups.perLanguage') }}
      </p>
      <ul class="mt-4 divide-y divide-line border-y border-line">
        <li
          v-for="row in groupRows"
          :key="row.group"
          class="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[16rem_minmax(0,1fr)_3.5rem]"
        >
          <!-- The target applies to each group across both languages, so it is only marked there. -->
          <span class="text-sm max-sm:col-span-2">{{ $t(`accuracy.groups.names.${row.group}`) }}<span
            v-if="language === 'both' && share(row.removal) < data.target"
            class="text-danger"
          >, {{ $t('accuracy.groups.below') }}</span></span>
          <AccuracyBar
            :value="share(row.removal)"
            :target="language === 'both' ? data.target : undefined"
          />
          <span class="text-right font-mono text-sm tabular-nums">{{ percent(share(row.removal)) }}</span>
          <span class="col-span-full text-xs text-fg-muted tabular-nums sm:col-start-2">
            {{ $t('accuracy.groups.detail', { typeCorrect: percent(share(row.typeCorrect)), withoutList: percent(share(row.withoutList)) }) }}
          </span>
        </li>
      </ul>
    </section>

    <section
      class="mt-10"
      aria-labelledby="long"
    >
      <h2
        id="long"
        class="text-md font-semibold"
      >
        {{ $t('accuracy.long.heading') }}
      </h2>
      <p class="mt-1 max-w-measure text-sm text-fg-muted">
        {{ $t('accuracy.long.note') }}
      </p>
      <dl class="mt-4 space-y-3">
        <div
          v-for="(position, index) in data.positions"
          :key="index"
          class="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-4 gap-y-1 sm:grid-cols-[16rem_minmax(0,1fr)_3.5rem]"
        >
          <dt class="text-sm max-sm:col-span-2">
            {{ $t(`accuracy.long.positions[${index}]`) }}
          </dt>
          <AccuracyBar :value="share(pick(position))" />
          <dd class="text-right font-mono text-sm tabular-nums">
            {{ percent(share(pick(position))) }}
          </dd>
        </div>
      </dl>
    </section>

    <section
      class="mt-10"
      aria-labelledby="rules"
    >
      <h2
        id="rules"
        class="text-md font-semibold"
      >
        {{ $t('accuracy.rules.heading') }}
      </h2>
      <p class="mt-1 max-w-measure text-sm text-fg-muted">
        {{ $t('accuracy.rules.note') }}
      </p>
      <AccuracyTypeTable
        class="mt-4"
        :rows="typeRows('hard-cases')"
        :precision="precision"
        :share="share"
      />
      <p class="mt-3 max-w-measure text-xs text-fg-muted">
        {{ $t('accuracy.rules.explain') }}
      </p>

      <details class="group mt-6 border-t border-line pt-4">
        <summary class="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-sm text-sm font-medium [&::-webkit-details-marker]:hidden">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            class="size-3.5 fill-none stroke-current stroke-[1.6] transition-transform duration-150 ease-out group-open:rotate-90 motion-reduce:transition-none"
          ><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
          {{ $t('accuracy.rules.generated') }}
        </summary>
        <p class="mt-2 max-w-measure text-sm text-fg-muted">
          {{ $t('accuracy.rules.generatedNote') }}
        </p>
        <AccuracyTypeTable
          class="mt-4"
          :rows="typeRows('generated')"
          :precision="precision"
          :share="share"
        />
      </details>
    </section>

    <section
      class="mt-10"
      aria-labelledby="gaps"
    >
      <h2
        id="gaps"
        class="text-md font-semibold"
      >
        {{ $t('accuracy.gaps.heading') }}
      </h2>
      <ul class="mt-2 max-w-measure list-disc space-y-1 pl-4 text-fg-muted marker:text-line-strong">
        <li
          v-for="(_, index) in ($tm('accuracy.gaps.items') as unknown[])"
          :key="index"
        >
          {{ $t(`accuracy.gaps.items[${index}]`) }}
        </li>
      </ul>
      <p class="mt-2 text-sm text-fg-muted">
        {{ $t('accuracy.gaps.mark') }}
      </p>
    </section>

    <section
      class="mt-10"
      aria-labelledby="speed"
    >
      <h2
        id="speed"
        class="text-md font-semibold"
      >
        {{ $t('accuracy.speed.heading') }}
      </h2>
      <p class="mt-2 max-w-measure text-fg-muted">
        {{ $t('accuracy.speed.text') }}
      </p>
    </section>

    <section
      class="mt-10"
      aria-labelledby="model"
    >
      <h2
        id="model"
        class="text-md font-semibold"
      >
        {{ $t('accuracy.model.heading') }}
      </h2>
      <p class="mt-2 max-w-measure text-fg-muted">
        {{ $t('accuracy.model.text', { model: data.model.original, license: data.model.license }) }}
      </p>
    </section>

    <section
      class="mt-10 border-t border-line pt-6"
      aria-labelledby="method"
    >
      <h2
        id="method"
        class="text-md font-semibold"
      >
        {{ $t('accuracy.method.heading') }}
      </h2>
      <ul class="mt-2 space-y-1 text-sm">
        <li>
          <a
            :href="`${GITHUB}/docs/accuracy.md`"
            class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
          >{{ $t('accuracy.method.docs') }}</a>
        </li>
        <li>
          <a
            :href="`${GITHUB}/data/eval`"
            class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
          >{{ $t('accuracy.method.data') }}</a>
        </li>
      </ul>
    </section>
  </article>
</template>
