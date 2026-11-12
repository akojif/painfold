<script setup lang="ts">
import type { Warning, WarningDecision } from '~~/core/review/review'

// One warning in a row: text that could identify someone. Not checked yet: a
// dashed underline in the risk colour and no fill, quieter than personal data
// waiting for review (FindingMark), and the dashes, not the colour, set it
// apart. Removed: its placeholder token, with the same motion as a finding.
// Kept: a dotted underline, like a kept finding, so it can still be changed.
// The label tells screen readers what it is.
const props = defineProps<{ warning: Warning, decision?: WarningDecision, placeholder: string, selected: boolean, motion?: RemovalMotion }>()
const emit = defineEmits<{ select: [event: MouseEvent | KeyboardEvent] }>()
const { t } = useI18n()

const label = computed(() => t('warning.markLabel', {
  kind: t(`warning.kind.${props.warning.reason}`),
  state: t(`warning.state.${props.decision ?? 'pending'}`),
  text: props.decision === 'remove' ? props.placeholder : props.warning.value,
}))
</script>

<template>
  <span
    role="button"
    tabindex="0"
    :data-warning="warning.key"
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
      class="box-decoration-clone wrap-anywhere underline decoration-1 underline-offset-4"
      :class="decision === 'dismiss' ? 'decoration-line-strong decoration-dotted' : 'decoration-danger decoration-dashed'"
    >{{ warning.value }}</span>
  </span>
</template>
