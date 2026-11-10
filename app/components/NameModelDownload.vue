<script setup lang="ts">
// The name model download: what it is and its size before anything is
// requested, then progress with Cancel, and Remove once it is stored. The
// column step shows it as a section; the review (compact) shows one quiet line
// for people who skipped it, and nothing once the model is ready.
//
// When the button that was used disappears (Download becomes Cancel, Cancel
// becomes Remove), focus moves to the action that replaced it, so a keyboard
// user is never dropped at the top of the page. Screen readers hear the start,
// the end and a failure, not every megabyte.
const props = defineProps<{ compact?: boolean }>()

const { t } = useI18n()
const { number } = useFormat()
const { enabled, total, costly, status, loaded, stored, download, cancel, remove } = useNameModel()

const megabytes = (bytes: number) => number(Math.round(bytes / 1_000_000))
const size = computed(() => t('nameModel.megabytes', { n: megabytes(total) }))
const progress = computed(() => t('nameModel.progress', { loaded: megabytes(loaded.value), total: megabytes(total) }))
const visible = computed(() => enabled && !(props.compact && (status.value === 'ready' || status.value === 'unknown')))

const root = useTemplateRef<HTMLElement>('root')
const announcement = ref('')
let hadFocus = false

watch(status, () => {
  hadFocus = root.value?.contains(document.activeElement) ?? false
}, { flush: 'pre' })

watch(status, (current, previous) => {
  const message = ({
    downloading: 'started',
    ready: previous === 'downloading' ? 'done' : undefined,
    failed: 'failed',
    absent: previous === 'downloading' ? 'cancelled' : previous === 'ready' ? 'removed' : undefined,
    offline: 'offline',
  } as Partial<Record<string, string | undefined>>)[current]
  announcement.value = message ? t(`nameModel.announce.${message}`) : ''
  if (hadFocus && !root.value?.contains(document.activeElement)) root.value?.querySelector<HTMLElement>('[data-focus]')?.focus()
}, { flush: 'post' })
</script>

<template>
  <div
    v-if="visible"
    ref="root"
    :class="compact ? 'text-sm' : 'border-t border-line pt-6'"
  >
    <template v-if="!compact">
      <h2 class="text-md font-semibold">
        {{ $t('nameModel.heading') }}
      </h2>
      <p
        v-if="status !== 'ready'"
        class="mt-1 max-w-measure text-sm text-fg-muted"
      >
        {{ $t('nameModel.explain', { size }) }}
      </p>
    </template>

    <div
      class="text-sm"
      :class="{ 'mt-4': !compact }"
    >
      <div
        v-if="status === 'absent' || status === 'unknown'"
        class="flex flex-wrap items-center gap-x-4 gap-y-2"
      >
        <span
          v-if="compact"
          class="text-fg-muted"
        >{{ $t('nameModel.notChecked') }}</span>
        <button
          type="button"
          data-focus
          :disabled="status === 'unknown'"
          :class="compact
            ? 'focus-ring rounded-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent'
            : 'press focus-ring h-9 rounded-md border border-line-strong px-3.5 font-medium hover:bg-surface disabled:opacity-50'"
          @click="download"
        >
          {{ $t(compact ? 'nameModel.downloadInline' : 'nameModel.download', { size }) }}
        </button>
        <span
          v-if="costly"
          class="text-fg-muted"
        >{{ $t('nameModel.costly') }}</span>
      </div>

      <div v-else-if="status === 'downloading'">
        <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p class="tabular-nums">
            {{ progress }}
          </p>
          <button
            type="button"
            data-focus
            class="press focus-ring rounded-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
            @click="cancel"
          >
            {{ $t('nameModel.cancel') }}
          </button>
        </div>
        <template v-if="!compact">
          <div
            role="progressbar"
            :aria-label="$t('nameModel.progressLabel')"
            aria-valuemin="0"
            :aria-valuemax="total"
            :aria-valuenow="loaded"
            :aria-valuetext="progress"
            class="mt-2 h-1 w-full max-w-md overflow-hidden rounded-full bg-line"
          >
            <div
              class="h-full origin-left bg-accent"
              :style="{ transform: `scaleX(${Math.min(loaded / total, 1)})` }"
            />
          </div>
          <p class="mt-2 text-fg-muted">
            {{ $t('nameModel.background') }}
          </p>
        </template>
      </div>

      <div
        v-else-if="status === 'ready'"
        class="flex flex-wrap items-baseline gap-x-4 gap-y-1"
      >
        <p>{{ stored ? $t('nameModel.stored', { size }) : $t('nameModel.notStored') }}</p>
        <button
          v-if="stored"
          type="button"
          data-focus
          class="press focus-ring rounded-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          @click="remove"
        >
          {{ $t('nameModel.remove') }}
        </button>
      </div>

      <div
        v-else-if="status === 'failed'"
        class="flex flex-wrap items-baseline gap-x-4 gap-y-1"
      >
        <p class="text-danger tabular-nums">
          {{ $t('nameModel.failed', { loaded: megabytes(loaded), total: megabytes(total) }) }}
          <span
            v-if="!compact"
            class="block text-fg-muted"
          >{{ $t('nameModel.withoutIt') }}</span>
        </p>
        <button
          type="button"
          data-focus
          class="press focus-ring rounded-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
          @click="download"
        >
          {{ $t('nameModel.retry') }}
        </button>
      </div>

      <p
        v-else-if="status === 'offline'"
        class="text-fg-muted"
      >
        {{ $t(compact ? 'nameModel.offlineInline' : 'nameModel.offline') }}
      </p>
    </div>

    <p
      class="sr-only"
      aria-live="polite"
    >
      {{ announcement }}
    </p>
  </div>
</template>
