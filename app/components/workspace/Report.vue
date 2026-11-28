<script setup lang="ts">
// Report in the workspace (#141): jobs, pains and gains, each a table of its
// themes in the canvas order, with the numbers counted in code (themes.ts).
// A theme's quotes and texts open in the drawer. The sidebar holds the
// sections and the cleaned file. It reads the analysis of this visit from
// memory and sends nothing. It also shows the demo (#130), a stored run on the
// sample file, with a note saying so.
import { barLength, intensityLevel, reportOf } from '~~/core/ai/results'
import type { Kind } from '~~/core/ai/merge'
import { LOW_CONFIDENCE_BELOW } from '~~/core/ai/themes'
import type { Theme } from '~~/core/ai/themes'
import { ANTHROPIC_MODELS } from '~~/core/ai/providers'

const { locale } = useI18n()
const localePath = useLocalePath()
const { number, percent, decimal, date } = useFormat()
const tagging = useTagging()
const session = useSession()
const cleanedFile = useCleanedFile()

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

const report = computed(() => (tagging.themes.value ? reportOf(tagging.themes.value) : undefined))
const analyzed = computed(() => tagging.result.value?.tagged.size ?? 0)
const model = computed(() => {
  const id = tagging.sent.value?.model ?? ''
  return ANTHROPIC_MODELS.find(choice => choice.id === id)?.name ?? id
})
const total = (section: { main: unknown[], few: unknown[] }) => section.main.length + section.few.length
const level = (theme: Theme) => intensityLevel(theme.intensity)

// The drawer: one theme at a time. Escape or Close returns focus to its row.
const keyOf = (kind: Kind, theme: Theme) => `${kind}:${theme.labels[0]}`
const openKey = ref<string>()
const openTheme = computed(() => {
  for (const section of report.value?.sections ?? []) {
    for (const theme of [...section.main, ...section.few]) {
      if (keyOf(section.kind, theme) === openKey.value) return { kind: section.kind, theme, few: section.few.includes(theme) }
    }
  }
  return undefined
})
function open(kind: Kind, theme: Theme) {
  openKey.value = keyOf(kind, theme)
}
function close() {
  const key = openKey.value
  openKey.value = undefined
  if (key) void nextTick(() => document.querySelector<HTMLElement>(`[data-theme-key="${CSS.escape(key)}"]`)?.focus())
}
</script>

<template>
  <WorkspaceBody
    v-if="report"
    :sidebar-label="$t('workspace.report.sidebar')"
  >
    <template #sidebar>
      <nav
        :aria-label="$t('results.sections')"
        class="space-y-2"
      >
        <h2 class="text-sm font-medium">
          {{ $t('workspace.report.onThisPage') }}
        </h2>
        <ul class="space-y-0.5">
          <li
            v-for="section in report.sections"
            :key="section.kind"
          >
            <a
              :href="`#${section.kind}`"
              class="focus-ring flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-tint"
            >{{ $t(`results.kinds.${section.kind}.title`) }}
              <span class="font-mono text-xs text-fg-muted tabular-nums">{{ number(total(section)) }}</span></a>
          </li>
        </ul>
      </nav>

      <!-- Many people also want the cleaned file itself; the report offers it too (#142). -->
      <section
        v-if="session.review.value"
        class="space-y-2 text-sm lg:mt-auto lg:border-t lg:border-line lg:pt-4"
        aria-labelledby="cleaned-file"
      >
        <h2
          id="cleaned-file"
          class="font-medium"
        >
          {{ $t('results.download.title') }}
        </h2>
        <p class="text-fg-muted">
          {{ $t('results.download.body') }}
        </p>
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
          class="font-mono text-xs text-fg-muted"
          :text="cleanedFile.fileName.value"
        />
      </section>
    </template>

    <div
      class="grid min-w-0 flex-1 items-start"
      :class="openTheme ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : ''"
    >
      <div class="min-w-0 px-4 pt-6 pb-16 sm:px-6 lg:pt-8">
        <h1 class="text-xl font-semibold text-balance">
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
        <p class="mt-3 max-w-measure text-fg-muted">
          {{ $t('results.lead', { n: number(analyzed), model }, analyzed) }}
        </p>
        <p class="mt-1 max-w-measure text-sm text-fg-muted">
          {{ $t('results.several') }}
        </p>

        <section
          v-for="section in report.sections"
          :id="section.kind"
          :key="section.kind"
          class="mt-10 scroll-mt-20"
          :aria-labelledby="`${section.kind}-heading`"
        >
          <h2
            :id="`${section.kind}-heading`"
            class="text-lg font-semibold"
          >
            {{ $t(`results.kinds.${section.kind}.title`) }}
          </h2>
          <p class="mt-1 text-sm text-fg-muted">
            {{ $t(`results.kinds.${section.kind}.lead`) }}
          </p>

          <p
            v-if="total(section) === 0"
            class="mt-4 text-fg-muted"
          >
            {{ $t(`results.kinds.${section.kind}.none`) }}
          </p>

          <table
            v-if="section.main.length > 0"
            class="mt-4 w-full table-fixed border-separate border-spacing-0 text-sm"
          >
            <caption class="sr-only">
              {{ $t('workspace.report.caption', { kind: $t(`results.kinds.${section.kind}.title`) }) }}
            </caption>
            <colgroup>
              <col>
              <col class="w-20">
              <col class="w-40 lg:w-48">
              <col class="w-36">
            </colgroup>
            <thead>
              <tr>
                <th
                  scope="col"
                  class="sticky top-14 z-10 h-9 border-b border-line bg-canvas px-3 text-left text-xs font-medium text-fg-muted"
                >
                  {{ $t('workspace.report.theme') }}
                </th>
                <th
                  scope="col"
                  class="sticky top-14 z-10 border-b border-line bg-canvas px-3 text-right text-xs font-medium text-fg-muted"
                >
                  {{ $t('results.column.texts') }}
                </th>
                <th
                  scope="col"
                  class="sticky top-14 z-10 border-b border-line bg-canvas px-3 text-left text-xs font-medium text-fg-muted"
                >
                  {{ $t('results.column.share') }}
                </th>
                <th
                  scope="col"
                  class="sticky top-14 z-10 border-b border-line bg-canvas px-3 text-left text-xs font-medium text-fg-muted"
                >
                  {{ $t('results.column.intensity') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="theme in section.main"
                :key="theme.labels[0]"
                class="cursor-pointer"
                :class="openKey === keyOf(section.kind, theme) ? 'bg-tint' : 'hover:bg-tint/60'"
                @click="open(section.kind, theme)"
              >
                <td class="relative border-b border-line px-3 py-2.5">
                  <span
                    v-if="openKey === keyOf(section.kind, theme)"
                    aria-hidden="true"
                    class="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent"
                  />
                  <button
                    type="button"
                    :data-theme-key="keyOf(section.kind, theme)"
                    :aria-expanded="openKey === keyOf(section.kind, theme)"
                    class="focus-ring rounded-sm text-left font-medium text-pretty wrap-anywhere"
                    @click.stop="open(section.kind, theme)"
                  >
                    {{ theme.name }}
                  </button>
                </td>
                <td class="border-b border-line px-3 text-right font-mono tabular-nums">
                  {{ number(theme.count) }}
                </td>
                <td class="border-b border-line px-3">
                  <span class="flex items-center gap-3">
                    <span class="w-9 shrink-0 font-mono tabular-nums">{{ percent(theme.share) }}</span>
                    <ChartBar
                      class="min-w-0 flex-1"
                      :value="barLength(theme.share, report.largestShare)"
                    />
                  </span>
                </td>
                <td class="border-b border-line px-3">
                  {{ $t(`results.intensity.${level(theme)}`) }}
                  <span class="font-mono text-fg-muted tabular-nums">{{ decimal(theme.intensity, 1) }}</span><span class="sr-only">&nbsp;{{ $t('results.intensity.outOf') }}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <div
            v-if="section.few.length > 0"
            class="mt-5"
          >
            <h3 class="text-sm text-fg-muted">
              {{ $t(`results.kinds.${section.kind}.few`, { n: number(section.few.length), min: LOW_CONFIDENCE_BELOW }, section.few.length) }}
            </h3>
            <ul class="mt-2 flex flex-wrap gap-2">
              <li
                v-for="theme in section.few"
                :key="theme.labels[0]"
              >
                <button
                  type="button"
                  :data-theme-key="keyOf(section.kind, theme)"
                  :aria-expanded="openKey === keyOf(section.kind, theme)"
                  class="focus-ring press flex items-baseline gap-2 rounded-md border px-2.5 py-1 text-left text-sm"
                  :class="openKey === keyOf(section.kind, theme) ? 'border-accent bg-tint' : 'border-line hover:bg-tint'"
                  @click="open(section.kind, theme)"
                >
                  <span class="wrap-anywhere">{{ theme.name }}</span>
                  <span class="font-mono text-xs text-fg-muted tabular-nums">{{ number(theme.count) }}<span class="sr-only">&nbsp;{{ $t('results.textsWord', theme.count) }}</span></span>
                </button>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <WorkspaceDrawer
        :open="Boolean(openTheme)"
        :title="openTheme?.theme.name ?? ''"
        :sub="openTheme ? $t(`results.kinds.${openTheme.kind}.title`) : undefined"
        focus-on-open
        @close="close"
      >
        <template v-if="openTheme">
          <dl class="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt class="text-xs text-fg-muted">
                {{ $t('results.column.texts') }}
              </dt>
              <dd class="font-mono tabular-nums">
                {{ number(openTheme.theme.count) }}
              </dd>
            </div>
            <template v-if="!openTheme.few">
              <div>
                <dt class="text-xs text-fg-muted">
                  {{ $t('results.column.share') }}
                </dt>
                <dd class="font-mono tabular-nums">
                  {{ percent(openTheme.theme.share) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-fg-muted">
                  {{ $t('results.column.intensity') }}
                </dt>
                <dd>
                  {{ $t(`results.intensity.${level(openTheme.theme)}`) }}
                  <span class="font-mono text-fg-muted tabular-nums">{{ decimal(openTheme.theme.intensity, 1) }}</span><span class="sr-only">&nbsp;{{ $t('results.intensity.outOf') }}</span>
                </dd>
              </div>
            </template>
          </dl>
          <h3 class="mt-6 border-b border-line pb-2 text-sm font-medium">
            {{ $t('workspace.report.quotes') }}
          </h3>
          <ThemeEvidence
            :key="openKey"
            class="mt-3"
            :theme="openTheme.theme"
          />
        </template>
      </WorkspaceDrawer>
    </div>
  </WorkspaceBody>

  <div
    v-else
    class="px-4 pt-6 pb-16 sm:px-6 lg:pt-8"
  >
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
  </div>
</template>
