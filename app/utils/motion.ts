/**
 * How a removed value turns into its placeholder. A pointer removal is rare
 * enough to show the wipe; keyboard removals happen hundreds of times in a
 * session, so they only fade. Reduced motion turns both off in main.css.
 */
export type RemovalMotion = 'wipe' | 'fade'

/** A click with detail 0 came from Enter or Space, not a pointer. */
export function motionFor(event?: MouseEvent | KeyboardEvent): RemovalMotion {
  return event instanceof MouseEvent && event.detail > 0 ? 'wipe' : 'fade'
}
