// One question at a time before work is lost ("Start over?"), answered in the
// dialog the layout shows (ConfirmDialog.vue). confirm() resolves to true only
// when the destructive button is chosen; Escape, a click outside and the other
// button all mean "keep working".
export type ConfirmQuestion = { title: string, body: string, confirm: string, cancel: string }

const question = shallowRef<ConfirmQuestion>()
let answer: ((confirmed: boolean) => void) | undefined

export function useConfirm() {
  function confirm(asked: ConfirmQuestion): Promise<boolean> {
    answer?.(false)
    question.value = asked
    return new Promise(resolve => (answer = resolve))
  }

  function respond(confirmed: boolean) {
    answer?.(confirmed)
    answer = undefined
    question.value = undefined
  }

  return { question: readonly(question), confirm, respond }
}

/**
 * Asks before the open file and the review are cleared, but only when there is
 * work to lose (useSession().hasWork). Resolves to true when it is fine to go on.
 */
export function useDiscardGuard() {
  const { t } = useI18n()
  const { hasWork } = useSession()
  const { confirm } = useConfirm()
  return async function mayDiscard(): Promise<boolean> {
    if (!hasWork.value) return true
    return confirm({ title: t('discard.title'), body: t('discard.body'), confirm: t('discard.confirm'), cancel: t('discard.cancel') })
  }
}
