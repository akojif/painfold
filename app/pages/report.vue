<script setup lang="ts">
// Stage 3, slice 6 (#128): the first report. Jobs, pains and gains in the
// canvas order, each ranked, with the numbers counted in code (themes.ts) and
// verified quotes linked to their rows. It reads the analysis of this visit
// from memory and sends nothing. Step 4 of the flow (#142). It also shows the
// demo (#130), a stored run on the sample file, with a note saying so.
import { LOW_CONFIDENCE_BELOW } from '~~/core/ai/themes'
import { ANTHROPIC_MODELS } from '~~/core/ai/providers'
import { reportOf } from '~~/core/ai/results'

definePageMeta({
  step: 4,
  // Below 768 px the layout shows SmallScreenNotice instead, also from a direct link (#139).
  working: true,
  needsReview: true,
  // No report without a checked file, except the demo (#130); this runs in the browser only.
  middleware: () => {
    // While the app takes over a served page, the layout decides once it is mounted.
    if (import.meta.client && !useNuxtApp().isHydrating && !useSession().review.value && !useTagging().demo.value && !useSmallScreen().narrow.value) return navigateTo(useLocalePath()('/'))
  },
})

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { number, date } = useFormat()
const tagging = useTagging()
const session = useSession()
const demo = computed(() => tagging.demo.value)
// The demo's theme names follow the interface language, like a live run's.
watch(locale, (now) => {
  if (demo.value && demo.value.language !== now) void tagging.loadDemo(now === 'de' ? 'de' : 'en')
})
/** Leaves the demo: back to Analyze with the open file, or to the start page. */
async function leaveDemo() {
  tagging.reset()
  await navigateTo(localePath(session.review.value ? '/analyze' : '/'))
}
useHead({ title: () => `${t('results.title')}, ${t('app.name')}` })

const themes = computed(() => tagging.themes.value)
const report = computed(() => (themes.value ? reportOf(themes.value) : undefined))
const analyzed = computed(() => tagging.result.value?.tagged.size ?? 0)
const model = computed(() => {
  const id = tagging.sent.value?.model ?? ''
  return ANTHROPIC_MODELS.find(choice => choice.id === id)?.name ?? id
})
const total = (section: { main: unknown[], few: unknown[] }) => section.main.length + section.few.length
// Many people also want the cleaned file itself; the report offers it too (#142).
const cleanedFile = useCleanedFile()
</script>

<template>
  <div class="max-w-4xl">
    <template v-if="report">
      <h1 class="text-2xl font-semibold text-balance">
        {{ $t('results.heading') }}
      </h1>
      <div
        v-if="demo"
        class="mt-4 max-w-measure rounded-md border border-line bg-surface px-4 py-3 text-sm"
        role="note"
      >
        <p>
          <span class="font-medium">{{ $t('results.demo.label') }}</span>
          {{ $t('results.demo.note', { date: date(demo.createdAt) }) }}
          <template v-if="!session.review.value">
            {{ $t('results.demo.noFile') }}
          </template>
        </p>
        <p
          v-if="demo.standIn"
          class="mt-1 text-danger"
        >
          {{ $t('results.demo.standIn') }}
        </p>
        <button
          type="button"
          class="focus-ring press mt-2 rounded-sm text-accent underline-offset-4 hover:underline"
          @click="leaveDemo"
        >
          {{ $t('results.demo.leave') }}
        </button>
      </div>
      <p class="mt-3 max-w-measure text-md text-fg-muted">
        {{ $t('results.lead', { n: number(analyzed), model }, analyzed) }}
      </p>
      <p class="mt-2 max-w-measure text-sm text-fg-muted">
        {{ $t('results.several') }}
      </p>

      <nav
        :aria-label="$t('results.sections')"
        class="mt-8"
      >
        <ul class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li
            v-for="section in report.sections"
            :key="section.kind"
          >
            <a
              :href="`#${section.kind}`"
              class="focus-ring rounded-sm underline-offset-4 hover:underline"
            >{{ $t(`results.kinds.${section.kind}.title`) }}
              <span class="font-mono text-fg-muted tabular-nums">{{ number(total(section)) }}</span></a>
          </li>
        </ul>
      </nav>

      <section
        v-for="section in report.sections"
        :id="section.kind"
        :key="section.kind"
        class="mt-14 scroll-mt-8"
        :aria-labelledby="`${section.kind}-heading`"
      >
        <h2
          :id="`${section.kind}-heading`"
          class="text-xl font-semibold"
        >
          {{ $t(`results.kinds.${section.kind}.title`) }}
        </h2>
        <p class="mt-1 text-fg-muted">
          {{ $t(`results.kinds.${section.kind}.lead`) }}
        </p>

        <p
          v-if="total(section) === 0"
          class="mt-6 text-fg-muted"
        >
          {{ $t(`results.kinds.${section.kind}.none`) }}
        </p>

        <template v-if="section.main.length > 0">
          <div
            aria-hidden="true"
            class="mt-6 hidden gap-x-6 pb-2 text-xs text-fg-muted sm:grid sm:grid-cols-[minmax(0,1fr)_4.5rem_10rem_8rem]"
          >
            <span />
            <span class="text-right">{{ $t('results.column.texts') }}</span>
            <span>{{ $t('results.column.share') }}</span>
            <span>{{ $t('results.column.intensity') }}</span>
          </div>
          <ol class="max-sm:mt-6">
            <ReportTheme
              v-for="theme in section.main"
              :key="theme.labels[0]"
              :theme="theme"
              :largest-share="report.largestShare"
            />
          </ol>
        </template>

        <div
          v-if="section.few.length > 0"
          class="border-t border-line pt-5"
          :class="{ 'mt-6': section.main.length === 0 }"
        >
          <h3 class="text-sm text-fg-muted">
            {{ $t(`results.kinds.${section.kind}.few`, { n: number(section.few.length), min: LOW_CONFIDENCE_BELOW }, section.few.length) }}
          </h3>
          <ul class="mt-3 space-y-1">
            <ReportFewTheme
              v-for="theme in section.few"
              :key="theme.labels[0]"
              :theme="theme"
            />
          </ul>
        </div>
      </section>

      <section
        v-if="session.review.value"
        class="mt-14 border-t border-line pt-6"
        aria-labelledby="cleaned-file"
      >
        <h2
          id="cleaned-file"
          class="font-medium"
        >
          {{ $t('results.download.title') }}
        </h2>
        <p class="mt-1 max-w-measure text-fg-muted">
          {{ $t('results.download.body') }}
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            class="focus-ring press inline-flex h-9 items-center rounded-md border border-line-strong bg-canvas px-3.5 font-medium hover:border-fg"
            aria-describedby="cleaned-file-name"
            @click="cleanedFile.download()"
          >
            {{ $t('review.downloadFile') }}
          </button>
          <MiddleTruncate
            id="cleaned-file-name"
            class="min-w-0 font-mono text-sm text-fg-muted"
            :text="cleanedFile.fileName.value"
          />
        </div>
      </section>
    </template>

    <template v-else>
      <h1 class="text-xl font-semibold">
        {{ $t('results.empty.heading') }}
      </h1>
      <p class="mt-2 max-w-measure text-md text-fg-muted">
        {{ $t('results.empty.body') }}
      </p>
      <NuxtLink
        :to="localePath('/analyze')"
        class="focus-ring press mt-6 inline-flex h-9 items-center rounded-md bg-fg px-3.5 font-medium text-canvas"
      >
        {{ $t('results.empty.analyze') }}
      </NuxtLink>
    </template>
  </div>
</template>
