import { identify, ImportError, MAX_FILE_BYTES, openFile, type FileFormatInfo, type ImportErrorCode } from '~~/core/import'

// Opening a file, the same way whether it was chosen, dropped anywhere on the
// page, or is the sample. The format is checked first: a document (on the
// roadmap) or a file Painfold cannot read gets a message and leaves whatever
// is open alone. Only a table replaces the open file, after asking if work
// would be lost, and then the column step opens.
const reading = ref<string>()
const error = ref<ImportErrorCode>()
const documentFormat = shallowRef<FileFormatInfo>()
// The open file's bytes stay in memory, so another sheet of a workbook can be read.
let lastFile: { name: string, bytes: Uint8Array } | undefined

export function useOpenFile() {
  const session = useSession()
  const route = useRoute()
  const localePath = useLocalePath()
  const mayDiscard = useDiscardGuard()

  function dismiss() {
    error.value = undefined
    documentFormat.value = undefined
  }

  /** Opens a file; resolves to true when a table was opened. */
  async function open(file: { name: string, bytes: Uint8Array }, options: { sheetName?: string, sample?: boolean } = {}): Promise<boolean> {
    dismiss()
    // What the file is decides what happens; nothing is cleared for a file that will not open.
    const format = file.bytes.length > 0 && file.bytes.length <= MAX_FILE_BYTES ? identify(file) : undefined
    if (format?.kind === 'document') {
      documentFormat.value = format
      return false
    }
    if (format?.status === 'supported' && !(await mayDiscard())) return false

    reading.value = file.name
    try {
      const opened = await openFile(file, { sheetName: options.sheetName })
      if (opened.kind === 'document') {
        documentFormat.value = opened.format
        return false
      }
      session.load(opened.table, options.sample)
      lastFile = file
      if (route.meta.step !== 1) await navigateTo(localePath('/'))
      return true
    }
    catch (caught) {
      error.value = caught instanceof ImportError ? caught.code : 'unreadable'
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

  /** Opens a file from the file picker or a drop. */
  async function openPicked(file: File) {
    await open({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
  }

  return { reading: readonly(reading), error: readonly(error), documentFormat: readonly(documentFormat), open, openSheet, openSample, openPicked, dismiss }
}
