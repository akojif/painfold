<script setup lang="ts">
// Stage 3, slice 3 (#125): exactly what will be sent, to whom, how many texts,
// the provider's terms and an estimated cost, before anything is sent. The
// preview and the download are the same payload object the analysis sends
// (core/ai/payload.ts). Sending itself arrives in slice 4 (#126).
import { estimate } from '~~/core/ai/cost'
import { buildPayload, payloadFileName, payloadJson } from '~~/core/ai/payload'
import { ANTHROPIC_MODELS } from '~~/core/ai/providers'
import { leakedValues } from '~~/core/export/csv'

const PREVIEW = 20
const MORE = 100
const localePath = useLocalePath()
const { number } = useFormat()
const { table, review, items, revision } = useSession()
const { where, model, ollamaModel } = useAiSettings()
const nameScan = useNameScan()

const provider = computed(() => (where.value === 'key' ? 'anthropic' as const : 'ollama' as const))
const modelId = computed(() => (where.value === 'key' ? model.value : ollamaModel.value ?? ''))
const modelName = computed(() => ANTHROPIC_MODELS.find(choice => choice.id === modelId.value)?.name ?? modelId.value)

// The payload, rebuilt whenever a decision in the review changes the cleaned texts.
const built = computed(() => {
  const current = (revision.value, review.value)
  if (!current || !items.value) return undefined
  // Only feedback and other free text: short values such as a channel or a plan
  // are not feedback, and stay in the browser for segments later.
  const texts = items.value.items.filter(item => item.display !== 'short')
  return buildPayload(texts.map(item => ({ item: item.id, text: current.cleanedItem(item.id) })), provider.value, modelId.value)
})
const payload = computed(() => built.value?.payload)
// Never expected: a value removed in the review inside the payload blocks sending.
const leaks = computed(() => (payload.value && review.value ? leakedValues(payloadJson(payload.value), review.value) : []))
const cost = computed(() => (payload.value ? estimate(payload.value) : undefined))
const money = (dollars: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: dollars < 1 ? 3 : 2 }).format(dollars)

const namesChecked = computed(() => nameScan.status.value === 'done')
const namesConfirmed = ref(false)

const query = ref('')
const shown = ref(PREVIEW)
const matching = computed(() => {
  const texts = payload.value?.texts ?? []
  const wanted = query.value.trim().toLowerCase()
  return wanted ? texts.filter(({ text }) => text.toLowerCase().includes(wanted)) : texts
})
watch(query, () => (shown.value = PREVIEW))

function download() {
  if (!payload.value) return
  saveTextFile(payloadFileName(payload.value, new Date()), payloadJson(payload.value), 'application/json;charset=utf-8')
}
</script>

<template>
  <section
    class="mt-12 max-w-measure border-t border-line pt-8"
    aria-labelledby="consent-heading"
  >
    <h2
      id="consent-heading"
      class="text-lg font-semibold"
    >
      {{ $t('consent.heading') }}
    </h2>

    <p
      v-if="!review || !items"
      class="mt-3 text-fg-muted"
    >
      {{ $t('consent.noReview') }}
      <NuxtLink
        :to="localePath('/')"
        class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
      >
        {{ $t('consent.openFile') }}
      </NuxtLink>
    </p>
    <p
      v-else-if="payload && payload.texts.length === 0"
      class="mt-3 text-fg-muted"
    >
      {{ $t('consent.nothing') }}
    </p>

    <template v-else-if="payload && cost">
      <p class="mt-3">
        {{ $t('consent.count', { n: number(payload.texts.length), file: table?.fileName ?? '' }, payload.texts.length) }}
      </p>
      <dl class="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
        <dt class="text-fg-muted">
          {{ $t('consent.to') }}
        </dt>
        <dd>{{ $t(`consent.toValue.${provider}`, { model: modelName }) }}</dd>
        <dt class="text-fg-muted">
          {{ $t('consent.terms') }}
        </dt>
        <dd>{{ $t(`consent.termsValue.${provider}`) }}</dd>
        <dt class="text-fg-muted">
          {{ $t('consent.notSent') }}
        </dt>
        <dd>{{ $t('consent.notSentValue') }}</dd>
        <dt class="text-fg-muted">
          {{ $t('consent.cost') }}
        </dt>
        <dd class="tabular-nums">
          {{ cost.cost
            ? $t('consent.costValue', { tokens: number(cost.inputTokens + cost.outputTokens), low: money(cost.cost.low), high: money(cost.cost.high) })
            : $t('consent.costFree', { tokens: number(cost.inputTokens + cost.outputTokens) }) }}
        </dd>
      </dl>

      <div class="mt-6">
        <label
          for="consent-search"
          class="text-sm text-fg-muted"
        >{{ $t('consent.search') }}</label>
        <input
          id="consent-search"
          v-model="query"
          type="search"
          class="focus-ring mt-1 h-9 w-full rounded-md border border-line-strong bg-canvas px-2.5"
        >
        <ol
          class="mt-3 divide-y divide-line border-y border-line"
          :aria-label="$t('consent.heading')"
        >
          <li
            v-for="text in matching.slice(0, shown)"
            :key="text.id"
            class="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 py-2 text-sm"
          >
            <span class="font-mono text-xs text-fg-muted tabular-nums">{{ text.id }}</span>
            <span class="break-words whitespace-pre-wrap">{{ text.text }}</span>
          </li>
        </ol>
        <p
          v-if="matching.length === 0"
          class="mt-2 text-sm text-fg-muted"
        >
          {{ $t('consent.noMatch') }}
        </p>
        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <button
            v-if="shown < matching.length && shown === PREVIEW"
            type="button"
            class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
            @click="shown = MORE"
          >
            {{ $t('consent.showAll', { n: number(matching.length) }) }}
          </button>
          <button
            v-else-if="shown < matching.length"
            type="button"
            class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
            @click="shown += MORE"
          >
            {{ $t('consent.showMore', { n: number(Math.min(MORE, matching.length - shown)) }) }}
          </button>
          <button
            type="button"
            class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
            @click="download"
          >
            {{ $t('consent.download') }}
          </button>
        </div>
      </div>

      <details class="mt-6 text-sm">
        <summary class="focus-ring cursor-pointer rounded-sm text-fg-muted hover:text-fg">
          {{ $t('consent.instructions') }}
        </summary>
        <pre class="mt-2 overflow-x-auto rounded-sm bg-surface p-3 font-mono text-xs whitespace-pre-wrap">{{ payload.instructions }}</pre>
      </details>

      <p
        v-if="leaks.length > 0"
        role="alert"
        class="mt-6 text-sm text-danger"
      >
        {{ $t('consent.leak') }}
      </p>

      <div
        v-if="!namesChecked"
        class="mt-6 text-sm"
      >
        <p>
          {{ $t('consent.names') }}
          <NuxtLink
            :to="localePath('/review')"
            class="focus-ring rounded-sm text-accent underline-offset-4 hover:underline"
          >
            {{ $t('consent.namesCheck') }}
          </NuxtLink>
        </p>
        <label class="mt-2 flex items-start gap-2">
          <input
            v-model="namesConfirmed"
            type="checkbox"
            class="focus-ring mt-0.5 size-4 accent-fg"
          >
          {{ $t('consent.namesConfirm') }}
        </label>
      </div>

      <div class="mt-6">
        <button
          type="button"
          disabled
          class="h-9 rounded-md bg-fg px-3.5 font-medium text-canvas opacity-50"
          aria-describedby="send-note"
        >
          {{ provider === 'anthropic'
            ? $t('consent.send', { n: number(payload.texts.length), provider: 'Anthropic' })
            : $t('consent.sendLocal', { n: number(payload.texts.length), model: modelName }) }}
        </button>
        <p
          id="send-note"
          class="mt-2 text-sm text-fg-muted"
        >
          {{ $t('consent.notYet') }}
        </p>
      </div>
    </template>
  </section>
</template>
