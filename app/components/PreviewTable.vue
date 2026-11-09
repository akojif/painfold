<script setup lang="ts">
const PREVIEW_ROWS = 5
const { table, roles } = useSession()
const rows = computed(() => table.value?.rows.slice(0, PREVIEW_ROWS) ?? [])
// The preview shows the file as it will be cleaned: dropped columns are left out.
// Short values (dates, plans, IDs) stay on one line at their own width; long
// ones wrap anywhere, so the table fits its container and the text gets the room.
const SHORT = 20
const wrapping = (text: string) => (text.length <= SHORT ? 'whitespace-nowrap' : 'wrap-anywhere')
const kept = computed(() => table.value?.columns.flatMap((column, index) => (roles.value[index] === 'drop' ? [] : [{ column, index }])) ?? [])
</script>

<template>
  <details
    v-if="table"
    class="group"
  >
    <summary class="focus-ring inline-flex cursor-pointer list-none items-center gap-2 rounded-sm text-sm font-medium [&::-webkit-details-marker]:hidden">
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        class="size-3.5 fill-none stroke-current stroke-[1.6] text-fg-muted group-open:rotate-90"
      ><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
      {{ $t('preview.heading', { n: rows.length }) }}
    </summary>
    <p class="mt-2 text-sm text-fg-muted">
      {{ $t('preview.note') }}
    </p>
    <div
      class="focus-ring mt-3 overflow-x-auto rounded-md border border-line"
      tabindex="0"
      role="region"
      :aria-label="$t('preview.label')"
    >
      <table class="w-full min-w-[36rem] text-left text-sm sm:min-w-0">
        <thead>
          <tr class="border-b border-line bg-surface">
            <th
              v-for="{ column } in kept"
              :key="column"
              scope="col"
              class="px-3 py-2 font-medium"
              :class="wrapping(column)"
            >
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in rows"
            :key="rowIndex"
            class="border-b border-line align-top last:border-b-0"
          >
            <td
              v-for="{ index } in kept"
              :key="index"
              class="px-3 py-2"
            >
              <span
                class="line-clamp-2"
                :class="wrapping(row[index] ?? '')"
              >{{ row[index] }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>
