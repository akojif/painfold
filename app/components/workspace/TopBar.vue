<script setup lang="ts">
// The workspace top bar, on every step of the working flow once a file is
// open: the logo, the four steps, the app controls and Start over. It spans
// the full width and fits from 768 px, the narrowest the flow supports.
defineProps<{ current: number }>()
const localePath = useLocalePath()
const startOver = useStartOver()

// The logo leads to the start screen; with a file open, that means starting
// over, after asking. A plain link, so a new tab opens as usual.
function onLogo(event: MouseEvent) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  void startOver()
}
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-line bg-canvas">
    <div class="flex h-14 items-stretch gap-3 px-3 lg:gap-6 lg:px-6">
      <a
        :href="localePath('/')"
        class="focus-ring flex items-center gap-2.5 self-center rounded-sm text-md font-semibold tracking-tight"
        @click="onLogo"
      >
        <span
          aria-hidden="true"
          class="relative size-[18px] shrink-0 rounded-[5px] bg-fg after:absolute after:inset-x-1 after:top-[7.5px] after:h-[3px] after:rounded-[1px] after:bg-canvas"
        />
        <span class="max-lg:sr-only">{{ $t('app.name') }}</span>
      </a>
      <WorkspaceSteps :current="current" />
      <div class="ml-auto flex items-center gap-1.5 lg:gap-2">
        <LanguageToggle />
        <ThemeToggle />
        <OutboundIndicator compact />
        <button
          type="button"
          class="press focus-ring ml-0.5 rounded-sm text-sm whitespace-nowrap text-fg-muted underline-offset-4 hover:text-fg hover:underline lg:ml-2"
          @click="startOver"
        >
          {{ $t('nav.startOver') }}
        </button>
      </div>
    </div>
  </header>
</template>
