<script setup lang="ts">
// The four steps of the working flow, as tabs in the workspace top bar. A
// step is a link once it can be reached; each says what it holds now (how
// much is left to review, an analysis running, how many themes). Steps
// before the current one are marked done, for screen readers too.
import type { RouteLocationRaw } from 'vue-router'
import { NuxtLink } from '#components'

const props = defineProps<{ current: number }>()
const localePath = useLocalePath()
const { t } = useI18n()
const { number } = useFormat()
const session = useSession()
const tagging = useTagging()

const left = computed(() => (session.revision.value, session.review.value?.counts().left ?? 0))
const themes = computed(() => (tagging.themes.value ? Object.values(tagging.themes.value).reduce((sum, list) => sum + list.length, 0) : 0))

type Step = { id: 'import' | 'review' | 'analyze' | 'report', to?: RouteLocationRaw, meta?: string }
const steps = computed<Step[]>(() => [
  { id: 'import', to: session.table.value ? localePath('/') : undefined },
  {
    id: 'review',
    to: session.review.value ? localePath('/review') : undefined,
    meta: session.review.value && left.value > 0 ? t('nav.meta.left', { n: number(left.value) }, left.value) : undefined,
  },
  { id: 'analyze', to: session.review.value ? localePath('/analyze') : undefined, meta: tagging.state.value === 'running' ? t('nav.meta.running') : undefined },
  { id: 'report', to: tagging.themes.value ? localePath('/report') : undefined, meta: themes.value ? t('nav.meta.themes', { n: number(themes.value) }, themes.value) : undefined },
])
const position = (index: number) => index + 1
</script>

<template>
  <nav
    :aria-label="$t('nav.label')"
    class="self-stretch"
  >
    <ol class="flex h-full items-stretch">
      <li
        v-for="(step, index) in steps"
        :key="step.id"
        class="flex"
        :aria-current="position(index) === props.current ? 'step' : undefined"
      >
        <component
          :is="step.to && position(index) !== props.current ? NuxtLink : 'span'"
          :to="position(index) !== props.current ? step.to : undefined"
          class="relative flex items-center gap-1.5 px-2.5 text-sm whitespace-nowrap lg:px-3"
          :class="[
            position(index) === props.current
              ? 'font-medium text-fg after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent lg:after:inset-x-3'
              : step.to ? 'focus-ring rounded-sm text-fg-muted hover:text-fg' : 'text-fg-muted',
          ]"
        >
          <svg
            v-if="position(index) < props.current"
            aria-hidden="true"
            viewBox="0 0 16 16"
            class="size-3.5 fill-none stroke-current stroke-2 text-accent"
          ><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>
          {{ $t(`nav.steps.${step.id}`) }}<span
            v-if="position(index) < props.current"
            class="sr-only"
          >, {{ $t('nav.done') }}</span>
          <span
            v-if="step.meta"
            class="font-mono text-xs font-normal text-fg-muted tabular-nums max-lg:sr-only"
          ><span class="sr-only">, </span>{{ step.meta }}</span>
        </component>
      </li>
    </ol>
  </nav>
</template>
