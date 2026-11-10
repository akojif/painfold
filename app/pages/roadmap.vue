<script setup lang="ts">
// What Painfold does now and what comes next, from app/utils/roadmap.ts.
// No dates: each stage ships when its "done when" criteria in ROADMAP.md are met.
const { t, tm, rt } = useI18n()
useHead({ title: () => `${t('roadmap.title')}, ${t('app.name')}` })

const current = currentStage()
const points = (id: StageId) => (tm(`roadmap.stages.${id}.points`) as unknown[]).map(point => rt(point as Parameters<typeof rt>[0]))

const badge: Record<StageStatus, string> = {
  available: 'bg-accent text-on-accent',
  inProgress: 'border border-accent text-accent',
  next: 'border border-line-strong text-fg',
  planned: 'border border-line text-fg-muted',
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-xl font-semibold">
      {{ $t('roadmap.title') }}
    </h1>
    <p class="mt-2 max-w-measure text-md text-fg-muted">
      {{ $t('roadmap.intro') }}
    </p>

    <ol
      class="mt-10"
      :aria-label="$t('roadmap.stagesLabel')"
    >
      <li
        v-for="(stage, index) in ROADMAP_STAGES"
        :key="stage.id"
        class="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 pb-8 last:pb-0"
        :aria-current="stage === current ? 'step' : undefined"
      >
        <!-- The rail: a hairline through all stages (through each item's bottom padding too), and a marker per stage. -->
        <div
          aria-hidden="true"
          class="relative flex justify-center"
        >
          <span
            class="absolute left-1/2 w-px -translate-x-1/2 bg-line"
            :class="[
              index === 0 ? (stage === current ? 'top-7' : 'top-3') : 'top-0',
              index === ROADMAP_STAGES.length - 1 ? (stage === current ? 'h-7' : 'h-3') : '-bottom-8',
            ]"
          />
          <span
            class="relative size-2.5 rounded-full ring-4 ring-canvas"
            :class="[
              stage === current ? 'mt-[1.375rem] bg-accent' : 'mt-1.5',
              stage !== current && stage.status === 'available' ? 'bg-fg' : '',
              stage !== current && stage.status !== 'available' ? 'border border-line-strong bg-canvas' : '',
            ]"
          />
        </div>

        <section
          :aria-labelledby="`stage-${stage.id}`"
          :class="stage === current ? 'rounded-md border border-line bg-surface p-4' : ''"
        >
          <p
            v-if="stage === current"
            class="mb-1 text-xs font-medium text-accent"
          >
            {{ $t('roadmap.current') }}
          </p>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2
              :id="`stage-${stage.id}`"
              class="flex items-baseline gap-2 font-medium"
            >
              <span class="font-mono text-xs text-fg-muted">{{ stage.version }}</span>{{ ' ' }}<span class="text-md text-fg">{{ $t(`roadmap.stages.${stage.id}.name`) }}</span>
            </h2>
            <span
              class="rounded-sm px-1.5 py-px text-xs font-medium"
              :class="badge[stage.status]"
            >{{ $t(`roadmap.status.${stage.status}`) }}</span>
          </div>
          <p class="mt-1.5 text-fg-muted">
            {{ $t(`roadmap.stages.${stage.id}.summary`) }}
          </p>
          <ul class="mt-2 list-disc space-y-0.5 pl-4 text-sm text-fg-muted marker:text-line-strong">
            <li
              v-for="point in points(stage.id)"
              :key="point"
            >
              {{ point }}
            </li>
          </ul>
        </section>
      </li>
    </ol>

    <a
      :href="ROADMAP_URL"
      class="focus-ring mt-10 inline-block rounded-sm text-sm text-accent underline-offset-4 hover:underline"
    >
      {{ $t('roadmap.full') }}
    </a>
  </div>
</template>
