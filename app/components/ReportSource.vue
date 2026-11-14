<script setup lang="ts">
// Where a quote came from ("Row 14"): opens the whole cleaned text in place,
// as it was sent, with the values kept from its row (channel, plan), so a
// quote can be checked without leaving the report. Two elements: the button
// sits on the quote's line and the text opens below it, across the whole
// line in a flex row (basis-full) or a grid (col-span-full).
const props = defineProps<{ item: string, openAtStart?: boolean }>()

const { itemById, placeOfUnit, attributesOfUnit } = useSession()
const { sentText } = useTagging()
const open = ref(props.openAtStart)
const panel = useId()

const found = computed(() => itemById(props.item))
const place = computed(() => (found.value ? placeOfUnit(found.value.unit) : undefined))
const attributes = computed(() => Object.entries(found.value ? attributesOfUnit(found.value.unit) : {}))
const text = computed(() => sentText.value.get(props.item) ?? '')
</script>

<template>
  <button
    type="button"
    class="focus-ring press shrink-0 justify-self-end rounded-sm font-mono text-xs text-fg-muted tabular-nums underline-offset-4 hover:text-fg hover:underline"
    :aria-expanded="open"
    :aria-controls="panel"
    @click="open = !open"
  >
    {{ place ? $t('review.row', { n: place.number }) : item }}
  </button>
  <div
    v-if="open"
    :id="panel"
    class="col-span-full mt-2 max-w-measure basis-full border-l border-line-strong pl-3 text-sm whitespace-pre-line text-fg"
  >
    <PlaceholderText :text="text" />
    <dl
      v-if="attributes.length > 0"
      class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted"
    >
      <div
        v-for="[name, value] in attributes"
        :key="name"
        class="flex gap-1.5"
      >
        <dt>{{ name }}</dt>
        <dd class="text-fg">
          {{ value }}
        </dd>
      </div>
    </dl>
  </div>
</template>
