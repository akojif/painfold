<script setup lang="ts">
// Found and correct per kind of personal data, for one set of the Accuracy page.
// labels: where each row's name comes from (typeMany.EMAIL, or warning.kind.age for the warnings).
type Score = { labelled: number, found: number, detected: number, correct: number }
withDefaults(defineProps<{
  rows: Array<{ type: string, score: Score }>
  precision: (score: Score) => number | undefined
  share: (counts: { labelled: number, found: number }) => number
  labels?: string
}>(), { labels: 'typeMany' })
const { number, percent } = useFormat()
</script>

<template>
  <table class="w-full text-left text-sm">
    <thead>
      <tr class="border-b border-line text-fg-muted">
        <th
          scope="col"
          class="py-2 pr-2 font-medium sm:pr-3"
        >
          {{ $t('accuracy.rules.type') }}
        </th>
        <th
          scope="col"
          class="py-2 pr-2 text-right font-medium sm:pr-3"
        >
          {{ $t('accuracy.rules.found') }}
        </th>
        <th
          scope="col"
          class="py-2 pr-2 text-right font-medium sm:pr-3"
        >
          {{ $t('accuracy.rules.correct') }}
        </th>
        <th
          scope="col"
          class="py-2 text-right font-medium"
        >
          {{ $t('accuracy.rules.values') }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in rows"
        :key="row.type"
        class="border-b border-line last:border-b-0"
      >
        <th
          scope="row"
          class="py-1.5 pr-2 font-normal hyphens-auto [overflow-wrap:anywhere] sm:pr-3"
        >
          {{ $t(`${labels}.${row.type}`) }}
        </th>
        <td class="py-1.5 pr-2 text-right font-mono whitespace-nowrap tabular-nums sm:pr-3">
          {{ percent(share(row.score)) }}
        </td>
        <td class="py-1.5 pr-2 text-right font-mono whitespace-nowrap tabular-nums sm:pr-3">
          {{ precision(row.score) === undefined ? '–' : percent(precision(row.score)!) }}
        </td>
        <td class="py-1.5 text-right font-mono whitespace-nowrap tabular-nums text-fg-muted">
          {{ number(row.score.labelled) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
