import { identify, ImportError, MAX_FILE_BYTES, openFile, type ImportErrorCode } from '~~/core/import'
import type { Toast } from '~/composables/useToast'

// Opening a file, the same way whether it was chosen, dropped anywhere on the
// page, or is the sample. The format is checked first: a document (on the
// roadmap) or a file Painfold cannot read gets a toast and leaves whatever is
// open alone. Only a table replaces the open file, after asking if work would
// be lost (a dialog: that is a decision), and then the column step opens.
const reading = ref<string>()

// A dropped file is answered where it was dropped: while it is checked the
// drop sheet stays, and a file that does not open shows its message on the
// sheet before the sheet shrinks into the toast (DropOverlay.vue). With
// reduced motion the toast simply appears.
export type DropFeedback = { phase: 'checking' } | { phase: 'outcome', toast: Omit<Toast, 'id'> }
const dropFeedback = shallowRef<DropFeedback>()
// The open file's bytes stay in memory, so another sheet of a workbook can be read.
let lastFile: { name: string, bytes: Uint8Array } | undefined

export function useOpenFile() {
  const session = useSession()
  const route = useRoute()
  const localePath = useLocalePath()
  const mayDiscard = useDiscardGuard()
  const { t } = useI18n()
  const toast = useToast()

  // Shown in the toast, or first on the drop sheet when the file was dropped.
  let dropped = false
  function report(message: Omit<Toast, 'id'>) {
    if (dropped && !matchMedia('(prefers-reduced-motion: reduce)').matches) dropFeedback.value = { phase: 'outcome', toast: message }
    else toast.show(message)
  }
  const planned = () => report({ tone: 'info', message: t('importNotes.document'), link: { to: localePath('/roadmap'), label: t('importNotes.roadmap') } })
  const problem = (code: ImportErrorCode) => report({ tone: 'problem', message: t(`importErrors.${code}`) })

  /** Opens a file; resolves to true when a table was opened. */
  async function open(file: { name: string, bytes: Uint8Array }, options: { sheetName?: string, sample?: boolean, dropped?: boolean } = {}): Promise<boolean> {
    dropped = options.dropped ?? false
    // What the file is decides what happens; nothing is cleared for a file that will not open.
    const format = file.bytes.length > 0 && file.bytes.length <= MAX_FILE_BYTES ? identify(file) : undefined
    if (format?.kind === 'document') {
      planned()
      return false
    }
    // A table: the drop sheet goes, so the question (if any) and the column step are in view.
    if (dropFeedback.value?.phase === 'checking') dropFeedback.value = undefined
    if (format?.status === 'supported' && !(await mayDiscard())) return false

    reading.value = file.name
    try {
      const opened = await openFile(file, { sheetName: options.sheetName })
      if (opened.kind === 'document') {
        planned()
        return false
      }
      session.load(opened.table, options.sample)
      lastFile = file
      if (route.meta.step !== 1) await navigateTo(localePath('/'))
      return true
    }
    catch (caught) {
      problem(caught instanceof ImportError ? caught.code : 'unreadable')
      return false
    }
    finally {
      reading.value = undefined
    }
  }

  /** Reads another sheet of the open workbook. */
  async function openSheet(sheetName: string) {
    if (lastFile) await open(lastFile, { sheetName, sample: session.isSample.value })
  }

  /** Opens the built-in sample. It is bundled with the app and loaded on demand: no request leaves this site. */
  async function openSample() {
    const { default: text } = await import('~~/data/sample/support-tickets.csv?raw')
    await open({ name: 'support-tickets.csv', bytes: new TextEncoder().encode(text) }, { sample: true })
  }

  /** Opens a file from the file picker or, with dropped, from a drop. */
  async function openPicked(file: File, { dropped = false } = {}) {
    if (dropped) dropFeedback.value = { phase: 'checking' }
    try {
      await open({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }, { dropped })
    }
    finally {
      if (dropFeedback.value?.phase === 'checking') dropFeedback.value = undefined
    }
  }

  /** The drop sheet has shown its message; the toast takes over. */
  function settleDrop() {
    const feedback = dropFeedback.value
    if (feedback?.phase === 'outcome') toast.show(feedback.toast)
    dropFeedback.value = undefined
  }

  return { reading: readonly(reading), dropFeedback: readonly(dropFeedback), open, openSheet, openSample, openPicked, settleDrop }
}
