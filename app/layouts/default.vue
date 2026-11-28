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
const tagging = useTagging()
const { table, hasWork } = session
// Pages outside the cleaning flow (the roadmap) have no step.
const step = computed(() => route.meta.step as number | undefined)
// The empty start screen explains the product instead; steps appear once a file
// is open. Without one, a later step is only reached on a small screen from a
// direct link (#139), where the steps would claim an import that never happened.
// The demo report has them with no file open too (#141); then no step is done.
const showSteps = computed(() => step.value !== undefined && (Boolean(table.value) || (step.value === 4 && Boolean(tagging.demo.value))))
// A file can be dropped anywhere, on every step. Without this a browser would
// open a dropped file itself and leave the app, losing everything in memory.
// Below 768 px a dropped file is caught but ignored (#139).
const { openPicked } = useOpenFile()
const { narrow } = useSmallScreen()
const { dragging } = useFileDrop(file => void openPicked(file, { dropped: true }), () => !narrow.value)

// The working flow (#139): Review, Download, Analyze and Report, and the column
// step on the start page once a file is open. Below 768 px it shows
// SmallScreenNotice instead. A media query hides the page from the first
// paint, and the page stays mounted when a file is open, so narrowing the
// window mid-flow loses nothing and widening it brings the page straight back.
// The router's route, not useRoute(): in a layout that one only moves on once
// the next page has rendered, and the guard decides whether it renders.
const current = useRouter().currentRoute
const working = computed(() => Boolean(current.value.meta.working) || (current.value.meta.step === 1 && Boolean(table.value)))
const mounted = ref(false)
// With no file open (a direct link), a small screen never renders a working page at all.
const renderPage = computed(() => !(mounted.value && narrow.value && working.value && !table.value))
// Review, Download, Analyze and Report need a checked file (Report also opens
// for the demo). Their prerendered pages, and the first render while the app
// takes over, show nothing, so a direct visit or a reload never shows a step it
// cannot open, and the page the app takes over is the same one it was served.
// Once mounted, the step appears, or the start page replaces it (#141 hotfix).
const gated = computed(() => Boolean(current.value.meta.needsReview))
const allowed = computed(() => Boolean(session.review.value) || (current.value.meta.step === 4 && tagging.demo.value))
const showPage = computed(() => renderPage.value && (!gated.value || (mounted.value && allowed.value)))
// Workspace pages (#141) span the full width below the top bar and place their own sidebar.
const workspace = computed(() => showSteps.value && Boolean(current.value.meta.workspace))
// Widened with nothing to review: where the page's own guard would have sent it.
watch(narrow, (now) => {
  if (!now && current.value.meta.needsReview && !session.review.value && !tagging.demo.value) void navigateTo(localePath('/'))
})

const startOver = useStartOver()

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
onMounted(() => {
  mounted.value = true
  if (gated.value && !allowed.value && !narrow.value) void navigateTo(localePath('/'), { replace: true })
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <!-- Once a file is open, the working flow has the workspace top bar: the steps, the controls and Start over (#141). -->
    <WorkspaceTopBar
      v-if="showSteps"
      :current="step!"
    />
    <header
      v-else
      class="sticky top-0 z-20 border-b border-line bg-canvas"
    >
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

    <div
      class="flex w-full flex-1 flex-col"
      :class="workspace ? '' : 'mx-auto max-w-6xl px-4 sm:px-6'"
    >
      <main
        class="flex flex-1 flex-col"
        :class="workspace ? '' : 'py-8 sm:py-10'"
      >
        <SmallScreenNotice
          v-if="working"
          class="md:hidden"
          :file-open="Boolean(table)"
        />
        <div
          v-if="showPage"
          class="flex flex-1 flex-col"
          :class="{ 'max-md:hidden': working }"
        >
          <slot />
        </div>
      </main>
    </div>

    <!-- One footer on every page (#147): links only, on one line on desktop in the header's grid
         (links on the left, the credit on the right). Below 768 px two short centred lines: the
         links, then the credit. The privacy notice is on the start page, Review and Analyze. -->
    <footer
      class="border-t border-line"
      data-toast-avoid
    >
      <div
        class="flex flex-col items-center gap-1.5 px-4 py-4 text-sm text-fg-muted sm:px-6 md:h-14 md:flex-row md:justify-between md:gap-6 md:py-0"
        :class="workspace ? '' : 'mx-auto max-w-6xl'"
      >
        <nav
          :aria-label="$t('footer.label')"
          class="flex items-center gap-5"
        >
          <NuxtLink
            :to="localePath('/roadmap')"
            class="focus-ring rounded-sm hover:text-fg"
          >
            {{ $t('footer.roadmap') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/accuracy')"
            class="focus-ring rounded-sm hover:text-fg"
          >
            {{ $t('footer.accuracy') }}
          </NuxtLink>
          <a
            href="https://github.com/akojif/painfold"
            class="focus-ring -m-1 grid place-items-center rounded-sm p-1 hover:text-fg"
          >
            <!-- The GitHub mark, from GitHub's Octicons (MIT). -->
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              class="size-4 fill-current"
            ><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" /></svg>
            <span class="sr-only">{{ $t('footer.source') }}</span>
          </a>
          <!-- What Painfold is, for language models and the people using them (llmstxt.org). -->
          <a
            href="/llms.txt"
            class="focus-ring rounded-sm font-mono text-xs hover:text-fg"
          >
            {{ $t('footer.llms') }}
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
            >{{ author.name }}<span class="sr-only">{{ ` ${$t('nav.newTab')}` }}</span></a>
          </template>
        </i18n-t>
      </div>
    </footer>
    <DropOverlay :visible="dragging" />
    <ToastRegion />
    <ConfirmDialog />
  </div>
</template>
