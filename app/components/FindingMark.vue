<script setup lang="ts">
import type { Decision, Finding } from '~~/core/review/review'

// One finding in a row. Pending: highlighter with an underline (colour alone
// does not reach 3:1 against the sheet). Removed: the ink bar with its
// placeholder; when removed by the reader, the bar sweeps over the value first.
// Kept: the value with a dotted underline, so it can still be changed.
const props = defineProps<{ finding: Finding, decision?: Decision, placeholder: string, selected: boolean, sweep: boolean }>()
const emit = defineEmits<{ select: [] }>()
const { t } = useI18n()

// value: the text; sweep: the bar crosses it; settle: the bar narrows to the
// placeholder; bar: only the placeholder is left, at its own width.
const stage = ref<'value' | 'sweep' | 'settle' | 'bar'>(props.decision === 'remove' ? 'bar' : 'value')
const root = useTemplateRef<HTMLElement>('root')
const valueEl = useTemplateRef<HTMLElement>('valueEl')
const placeholderEl = useTemplateRef<HTMLElement>('placeholderEl')
let timer: ReturnType<typeof setTimeout> | undefined

// Widths go through the DOM: a server-rendered style attribute would break the CSP.
const setWidth = (element?: HTMLElement | null) => {
  if (root.value) root.value.style.width = element ? `${element.offsetWidth}px` : ''
}

watch(() => props.decision, (decision) => {
  clearTimeout(timer)
  if (decision !== 'remove') {
    stage.value = 'value'
    setWidth()
    return
  }
  if (!props.sweep || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.value = 'bar'
    setWidth()
    return
  }
  setWidth(valueEl.value)
  stage.value = 'sweep'
  timer = setTimeout(() => {
    stage.value = 'settle'
    setWidth(placeholderEl.value)
    timer = setTimeout(() => {
      stage.value = 'bar'
      setWidth()
    }, 320)
  }, 260)
})

onBeforeUnmount(() => clearTimeout(timer))

const label = computed(() => t('review.markLabel', {
  type: t(`typeOne.${props.finding.type}`),
  state: t(`review.state.${props.decision ?? 'pending'}`),
  text: props.decision === 'remove' ? props.placeholder : props.finding.value,
}))
</script>

<template>
  <button
    ref="root"
    type="button"
    :data-finding="finding.id"
    :aria-label="label"
    :aria-current="selected ? 'true' : undefined"
    class="relative inline-block max-w-full overflow-hidden text-left align-bottom outline-ink transition-[width] duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
    :class="{ 'outline-2 outline-offset-1': selected }"
    @click="emit('select')"
  >
    <span
      v-if="stage !== 'bar'"
      ref="valueEl"
      class="inline-block max-w-full px-0.5 break-all"
      :class="{
        'border-b-2 border-ink bg-highlighter text-on-highlighter': !decision || stage === 'sweep',
        'underline decoration-rule-strong decoration-dotted decoration-2 underline-offset-4': decision === 'keep',
        'invisible': stage === 'settle',
      }"
    >{{ finding.value }}</span>
    <span
      v-if="stage === 'sweep' || stage === 'settle'"
      class="absolute inset-0 bg-redaction"
      :class="{ 'origin-left animate-ink-sweep': stage === 'sweep' }"
    />
    <span
      v-if="stage === 'settle'"
      class="absolute inset-0 flex items-center justify-center font-mono text-[0.8em] text-on-redaction animate-ink-reveal"
    >{{ placeholder }}</span>
    <span
      v-if="stage === 'bar'"
      class="inline-block bg-redaction px-1.5 font-mono text-[0.8em] text-on-redaction"
    >{{ placeholder }}</span>
    <span
      ref="placeholderEl"
      aria-hidden="true"
      class="invisible absolute top-0 left-0 inline-block px-1.5 font-mono text-[0.8em]"
    >{{ placeholder }}</span>
  </button>
</template>
