<script setup lang="ts">
const PREVIEW_ROWS = 5
const { table, roles } = useSession()
const rows = computed(() => table.value?.rows.slice(0, PREVIEW_ROWS) ?? [])
</script>

<template>
  <section v-if="table">
    <h2 class="text-xl font-semibold">
      {{ $t('preview.heading', { n: rows.length }) }}
    </h2>
    <p class="mt-1 text-sm text-ink-muted">
      {{ $t('preview.dropped') }}
    </p>
    <div
      class="mt-4 overflow-x-auto border border-rule bg-sheet outline-signal focus-visible:outline-2"
      tabindex="0"
      role="region"
      :aria-label="$t('preview.label')"
    >
      <table class="min-w-full text-left text-sm">
        <thead>
          <tr class="border-b border-rule">
            <th
              v-for="(column, index) in table.columns"
              :key="column"
              scope="col"
              class="px-3 py-2 font-semibold whitespace-nowrap"
              :class="{ 'text-ink-muted line-through': roles[index] === 'drop' }"
            >
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in rows"
            :key="rowIndex"
            class="border-b border-rule last:border-b-0"
          >
            <td
              v-for="(cell, index) in row"
              :key="index"
              class="max-w-[32ch] truncate px-3 py-2"
              :class="{ 'text-ink-muted line-through': roles[index] === 'drop' }"
            >
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
