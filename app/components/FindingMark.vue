<script setup lang="ts">
import type { Decision, Finding } from '~~/core/review/review'

// One finding in a row. Pending: soft amber with an underline, so colour is
// not the only cue. Removed: its placeholder token, revealed left to right
// when removed with the pointer and faded in when removed from the keyboard.
// Kept: the value with a dotted underline, so it can still be changed.
// A span, not a <button>: a button is an atomic inline box, which lets a
// comma or full stop after the value wrap onto the next line on its own.
// The current finding gets a ring, not an outline: drawn per line, it stays
// tidy when a long value wraps.
const props = defineProps<{ finding: Finding, decision?: Decision, placeholder: string, selected: boolean, motion?: RemovalMotion }>()
const emit = defineEmits<{ select: [event: MouseEvent | KeyboardEvent] }>()
const { t } = useI18n()

const label = computed(() => t('review.markLabel', {
  type: t(`typeOne.${props.finding.type}`),
  state: t(`review.state.${props.decision ?? 'pending'}`),
  text: props.decision === 'remove' ? props.placeholder : props.finding.value,
}))
</script>

<template>
  <span
    role="button"
    tabindex="0"
    :data-finding="finding.id"
    :aria-label="label"
    :aria-current="selected ? 'true' : undefined"
    class="focus-ring cursor-pointer rounded-sm box-decoration-clone"
    :class="{ 'ring-1 ring-fg': selected }"
    @click="emit('select', $event)"
    @keydown.enter.space.prevent="emit('select', $event)"
  >
    <RedactionToken
      v-if="decision === 'remove'"
      :placeholder="placeholder"
      :motion="motion"
    />
    <span
      v-else
      class="box-decoration-clone wrap-anywhere"
      :class="decision === 'keep'
        ? 'underline decoration-line-strong decoration-dotted decoration-1 underline-offset-4'
        : 'rounded-sm bg-pending px-0.5 text-on-pending underline decoration-pending-line decoration-1 underline-offset-4'"
    >{{ finding.value }}</span>
  </span>
</template>
