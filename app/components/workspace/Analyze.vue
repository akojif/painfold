<script setup lang="ts">
// Analyze in the workspace (#141): the sidebar says what each part of the
// page still needs; the page is where the analysis runs (AnalyzeSetup, and
// the demo for the sample), then the consent step, the only way to send,
// which shows exactly what is sent.
import { ANTHROPIC_MODELS } from '~~/core/ai/providers'

const { t } = useI18n()
const { number } = useFormat()
const { review, revision } = useSession()
const { where, model, key, ollamaModel, tested } = useAiSettings()
const nameScan = useNameScan()
const tagging = useTagging()
// Two steps: where it runs, then, once the connection test works (or an
// analysis has started), what is sent and the button that sends it.
const sendShown = computed(() => tested.value || tagging.state.value !== 'idle')

const connected = computed(() => (where.value === 'key' ? Boolean(key.value.trim()) : Boolean(ollamaModel.value)))
const modelName = computed(() => (where.value === 'key' ? ANTHROPIC_MODELS.find(choice => choice.id === model.value)?.name ?? model.value : ollamaModel.value ?? ''))
const left = computed(() => (revision.value, review.value?.counts().left ?? 0))
const sections = computed(() => [
  {
    id: 'connection',
    label: t('workspace.analyze.connection'),
    state: connected.value ? modelName.value : t('workspace.analyze.notSetUp'),
    done: connected.value,
  },
  {
    id: 'send',
    label: t('workspace.analyze.send'),
    state: !sendShown.value
      ? t('workspace.analyze.afterTest')
      : left.value > 0
        ? t('workspace.analyze.findingsLeft', { n: number(left.value) }, left.value)
        : nameScan.status.value === 'done' ? t('workspace.analyze.ready') : t('workspace.analyze.namesNotChecked'),
    done: sendShown.value && left.value === 0 && nameScan.status.value === 'done',
  },
])
</script>

<template>
  <WorkspaceBody :sidebar-label="$t('workspace.analyze.sidebar')">
    <template #sidebar>
      <nav aria-labelledby="analyze-on-page">
        <h2
          id="analyze-on-page"
          class="text-sm font-medium"
        >
          {{ $t('workspace.analyze.onThisPage') }}
        </h2>
        <ol class="mt-2 space-y-1">
          <li
            v-for="section in sections"
            :key="section.id"
          >
            <a
              :href="`#${section.id}`"
              class="focus-ring flex gap-2.5 rounded-md px-2 py-1.5 hover:bg-tint"
            >
              <span
                aria-hidden="true"
                class="mt-1.5 size-1.5 shrink-0 rounded-full"
                :class="section.done ? 'bg-accent' : 'border border-line-strong'"
              />
              <span class="min-w-0">
                <span class="block text-sm font-medium">{{ section.label }}</span>
                <span class="block text-sm text-fg-muted">{{ section.state }}</span>
              </span>
            </a>
          </li>
        </ol>
      </nav>
      <!-- The privacy notice where people choose what leaves (#147): in view in both steps. -->
      <PrivacyNotice class="text-sm md:col-span-2 lg:mt-auto lg:border-t lg:border-line lg:pt-4" />
    </template>

    <div class="max-w-2xl px-4 pt-6 pb-16 sm:px-6 lg:pt-8">
      <h1 class="text-xl font-semibold">
        {{ $t('analyze.heading') }}
      </h1>
      <p class="mt-2 max-w-measure text-md text-fg-muted">
        {{ $t('analyze.lead') }}
      </p>

      <section
        id="connection"
        :aria-label="$t('workspace.analyze.connection')"
        class="mt-8 scroll-mt-20 space-y-6"
      >
        <!-- The demo is for those without a key; once connected it has nothing to offer. -->
        <AnalyzeDemo v-if="!tested" />
        <AnalyzeSetup />
      </section>

      <section
        v-if="sendShown"
        id="send"
        :aria-label="$t('workspace.analyze.send')"
        class="scroll-mt-20"
      >
        <ConsentStep />
      </section>
      <p
        v-else
        class="mt-10 border-t border-line pt-6 text-sm text-fg-muted"
      >
        {{ $t('workspace.analyze.sendAfterTest') }}
      </p>
    </div>
  </WorkspaceBody>
</template>
