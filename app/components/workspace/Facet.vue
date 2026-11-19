<script setup lang="ts">
// One filter group, a checkbox per option with its count, like a shop's filters.
defineProps<{ legend: string, options: { key: string, label: string, count: number, color?: string }[] }>()
const model = defineModel<string[]>({ required: true })
const { number } = useFormat()
</script>

<template>
  <fieldset>
    <legend class="mb-1.5 text-sm font-medium">
      {{ legend }}
    </legend>
    <ul class="space-y-px">
      <li
        v-for="option in options"
        :key="option.key"
      >
        <label
          class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-1.5 text-sm hover:bg-tint"
          :class="option.count === 0 && !model.includes(option.key) ? 'text-fg-muted' : ''"
        >
          <input
            v-model="model"
            type="checkbox"
            :value="option.key"
            class="focus-ring size-3.5 shrink-0 accent-fg"
          >
          <span
            v-if="option.color"
            aria-hidden="true"
            class="size-2 shrink-0 rounded-full"
            :style="{ background: option.color }"
          />
          <span
            class="min-w-0 flex-1 truncate"
            :title="option.label"
          >{{ option.label }}</span>
          <span class="font-mono text-xs text-fg-muted tabular-nums">{{ number(option.count) }}</span>
        </label>
      </li>
    </ul>
  </fieldset>
</template>
