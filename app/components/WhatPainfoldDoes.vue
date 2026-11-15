<script setup lang="ts">
// "What Painfold does" on the start page (#145): the three steps, each with a
// small line drawing, its status, a title and one sentence. The status comes
// from the roadmap (app/utils/roadmap.ts), so a release changes it in one
// place: available, preview (usable, not released yet: its quality numbers
// are not published), or coming in a later version.
const STEPS = [
  { key: 'clean', stage: 'clean' },
  { key: 'find', stage: 'jobs' },
  { key: 'decide', stage: 'report' },
] as const

const steps = STEPS.map(step => ({ ...step, ...stageOf(step.stage) }))
</script>

<template>
  <ol
    :aria-label="$t('start.journeyLabel')"
    class="grid grid-cols-3 divide-x divide-line rounded-md border border-line bg-surface"
  >
    <li
      v-for="step in steps"
      :key="step.key"
      class="flex flex-col gap-3 p-5 lg:flex-row lg:gap-4 lg:p-6"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 40 40"
        class="size-10 shrink-0 fill-none stroke-fg-muted stroke-[1.5]"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <template v-if="step.key === 'clean'">
          <!-- A page whose middle line is a redaction token, as in the review. -->
          <rect
            x="8"
            y="5"
            width="24"
            height="30"
            rx="3"
          />
          <path d="M13 12h14M13 28h9" />
          <rect
            x="13"
            y="17.5"
            width="14"
            height="5"
            rx="1"
            class="fill-token stroke-token"
          />
        </template>
        <template v-else-if="step.key === 'find'">
          <!-- Themes, ranked. -->
          <rect
            x="7"
            y="8"
            width="26"
            height="5"
            rx="1.5"
          />
          <rect
            x="7"
            y="17.5"
            width="18"
            height="5"
            rx="1.5"
          />
          <rect
            x="7"
            y="27"
            width="11"
            height="5"
            rx="1.5"
          />
        </template>
        <template v-else>
          <!-- A question for the team: "How might we…". -->
          <path d="M11 7h18a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H19l-6 5v-5h-2a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4Z" />
          <path d="M17 14a3 3 0 1 1 4.2 2.75c-.75.33-1.2.95-1.2 1.75v.5" />
          <circle
            cx="20"
            cy="22.5"
            r=".6"
            class="fill-fg-muted"
          />
        </template>
      </svg>
      <div class="min-w-0">
        <p class="text-xs text-fg-muted">
          {{ step.status === 'available' || step.status === 'preview' ? $t(`roadmap.status.${step.status}`) : $t('start.journey.coming', { version: step.version }) }}
        </p>
        <p class="mt-1 font-medium">
          {{ $t(`start.journey.${step.key}.title`) }}
        </p>
        <p class="mt-1 text-sm text-fg-muted">
          {{ $t(`start.journey.${step.key}.body`) }}
        </p>
      </div>
    </li>
  </ol>
</template>
