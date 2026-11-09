<script setup lang="ts">
const PREVIEW_ROWS = 5
const { table, roles } = useSession()
const rows = computed(() => table.value?.rows.slice(0, PREVIEW_ROWS) ?? [])
</script>

<template>
  <section v-if="table">
    <h2 class="text-md font-semibold">
      {{ $t('preview.heading', { n: rows.length }) }}
    </h2>
    <p class="mt-1 text-sm text-fg-muted">
      {{ $t('preview.dropped') }}
    </p>
    <div
      class="focus-ring mt-3 overflow-x-auto rounded-md border border-line"
      tabindex="0"
      role="region"
      :aria-label="$t('preview.label')"
    >
      <table class="min-w-full text-left text-sm">
        <thead>
          <tr class="border-b border-line bg-surface">
            <th
              v-for="(column, index) in table.columns"
              :key="column"
              scope="col"
              class="px-3 py-2 text-sm font-medium whitespace-nowrap"
              :class="{ 'text-fg-muted line-through': roles[index] === 'drop' }"
            >
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in rows"
            :key="rowIndex"
            class="border-b border-line last:border-b-0"
          >
            <td
              v-for="(cell, index) in row"
              :key="index"
              class="max-w-[32ch] truncate px-3 py-2"
              :class="{ 'text-fg-muted line-through': roles[index] === 'drop' }"
            >
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
