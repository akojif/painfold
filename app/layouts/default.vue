<script setup lang="ts">
// Set here rather than in app.vue: the error page (404) renders this layout but not app.vue.
useHead({
  bodyAttrs: { class: 'bg-canvas text-fg font-sans text-base antialiased' },
})
// <html lang> and the hreflang links to the same page in the other language.
const localeHead = useLocaleHead()
useHead(() => ({
  htmlAttrs: { lang: localeHead.value.htmlAttrs.lang },
  link: localeHead.value.link,
}))
const localePath = useLocalePath()
const route = useRoute()
// A name and a URL, the same in every language, so they are not in the locale files.
const author = { name: 'Francis Akoji', url: 'https://francisakoji.com' }
const session = useSession()
const { table, hasWork } = session
const mayDiscard = useDiscardGuard()
// Pages outside the cleaning flow (the roadmap) have no step.
const step = computed(() => route.meta.step as number | undefined)
// The empty start screen explains the product instead; steps appear once a file is open.
const showSteps = computed(() => step.value !== undefined && (step.value > 1 || Boolean(table.value)))
// The empty start screen states the privacy notice in its own content; every other page states it here.
const showNotice = computed(() => step.value !== 1 || Boolean(table.value))
const facts = computed(() => [...(showNotice.value ? ['privacy.notice'] : []), 'footer.noCookies', 'footer.noAccount'])
// A file can be dropped anywhere, on every step. Without this a browser would
// open a dropped file itself and leave the app, losing everything in memory.
const { openPicked } = useOpenFile()
const { dragging } = useFileDrop(file => void openPicked(file))

/** Back to the start screen with nothing open, after asking if work would be lost. */
async function startOver() {
  if (!(await mayDiscard())) return
  session.clear()
  await navigateTo(localePath('/'))
}

// The logo leads to the start screen; with a file open, that means starting over.
// A plain link, so this runs before any navigation; a new tab opens as usual.
function onLogo(event: MouseEvent) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  if (table.value) void startOver()
  else void navigateTo(localePath('/'))
}

// Closing or reloading the tab, or leaving the site with Back, while there is work to lose:
// the browser asks with its own warning (it does not show a custom text).
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasWork.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="sticky top-0 z-20 border-b border-line bg-canvas">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
        <a
          :href="localePath('/')"
          class="focus-ring flex items-center gap-2.5 rounded-sm text-md font-semibold tracking-tight"
          @click="onLogo"
        >
          <span
            aria-hidden="true"
            class="relative size-[18px] rounded-[5px] bg-fg after:absolute after:inset-x-1 after:top-[7.5px] after:h-[3px] after:rounded-[1px] after:bg-canvas"
          />
          <!-- On the narrowest screens the mark alone leaves room for the switches; screen readers still hear the name. -->
          <span class="max-[399px]:sr-only">{{ $t('app.name') }}</span>
        </a>
        <div class="flex items-center gap-1.5 sm:gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <OutboundIndicator />
        </div>
      </div>
    </header>

    <div class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
      <!-- Once a file is open, Start over sits at the end of the steps on every step, in the same place. -->
      <div
        v-if="showSteps"
        class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-6"
      >
        <AppStepper :current="step!" />
        <button
          v-if="table"
          type="button"
          class="press focus-ring rounded-sm text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          @click="startOver"
        >
          {{ $t('nav.startOver') }}
        </button>
      </div>
      <main class="flex flex-1 flex-col py-8 sm:py-10">
        <slot />
      </main>
    </div>

    <footer class="border-t border-line">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-sm text-fg-muted sm:px-6">
        <!-- What Painfold promises, each with a teal dot like the header's network indicator. -->
        <ul
          :aria-label="$t('footer.factsLabel')"
          class="flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          <li
            v-for="fact in facts"
            :key="fact"
            class="flex items-center gap-2"
          >
            <span
              aria-hidden="true"
              class="size-1.5 shrink-0 rounded-full bg-accent"
            />
            {{ $t(fact) }}
          </li>
        </ul>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
          <nav class="flex gap-5">
            <NuxtLink
              :to="localePath('/roadmap')"
              class="focus-ring rounded-sm hover:text-fg"
            >
              {{ $t('footer.roadmap') }}
            </NuxtLink>
            <a
              href="https://github.com/akojif/painfold"
              class="focus-ring flex items-center gap-1.5 rounded-sm hover:text-fg"
            >
              <!-- The GitHub mark, from GitHub's Octicons (MIT). -->
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                class="size-3.5 fill-current"
              ><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" /></svg>
              {{ $t('footer.source') }}
            </a>
          </nav>
          <i18n-t
            keypath="footer.credit"
            tag="p"
            scope="global"
          >
            <template #name>
              <a
                :href="author.url"
                target="_blank"
                rel="noopener"
                class="focus-ring rounded-sm text-fg underline-offset-4 hover:underline"
              >{{ author.name }}</a>
            </template>
          </i18n-t>
        </div>
      </div>
    </footer>
    <DropOverlay :visible="dragging" />
    <ToastRegion />
    <ConfirmDialog />
  </div>
</template>
