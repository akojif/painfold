<script setup lang="ts">
// A theme's evidence: its strongest verified quotes, each linked to where it
// came from, and every text in the theme on request. Quotes were checked word
// for word against the text that was sent (core/ai/tagging.ts).
import { QUOTES_SHOWN } from '~~/core/ai/results'
import type { Theme } from '~~/core/ai/themes'

const props = defineProps<{ theme: Theme }>()
const { number } = useFormat()
const quotes = computed(() => props.theme.quotes.slice(0, QUOTES_SHOWN))
const showAll = ref(false)
const all = useId()
</script>

<template>
  <div class="text-sm">
    <!-- Each quote's row sits in the theme's Texts column, so sources line up. -->
    <ul
      v-if="quotes.length > 0"
      class="space-y-2"
    >
      <li
        v-for="quote in quotes"
        :key="quote.item"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 sm:grid-cols-[minmax(0,1fr)_4.5rem_10rem_8rem] sm:gap-x-6"
      >
        <q class="max-w-measure text-fg">
          <PlaceholderText :text="quote.quote" />
        </q>
        <ReportSource :item="quote.item" />
      </li>
    </ul>
    <p
      v-else
      class="text-fg-muted"
    >
      {{ $t('results.noQuote') }}
    </p>

    <button
      type="button"
      class="focus-ring press mt-3 rounded-sm text-accent underline-offset-4 hover:underline"
      :aria-expanded="showAll"
      :aria-controls="all"
      @click="showAll = !showAll"
    >
      {{ showAll ? $t('results.hideTexts') : $t('results.allTexts', { n: number(theme.count) }) }}
    </button>
    <ul
      v-if="showAll"
      :id="all"
      class="mt-3 space-y-2"
    >
      <li
        v-for="item in theme.items"
        :key="item"
        class="flex flex-wrap items-baseline gap-x-3"
      >
        <ReportSource
          :item="item"
          open-at-start
        />
      </li>
    </ul>
  </div>
</template>
