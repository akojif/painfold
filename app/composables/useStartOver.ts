/** Back to the start screen with nothing open, after asking if work would be lost. */
export function useStartOver() {
  const mayDiscard = useDiscardGuard()
  const session = useSession()
  const localePath = useLocalePath()
  return async function startOver() {
    if (!(await mayDiscard())) return
    session.clear()
    await navigateTo(localePath('/'))
  }
}
