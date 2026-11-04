/** Mouse-event helpers for tab-like elements (no React or Next imports, so they unit-test without a DOM). */

/** The parts of a mouse event these helpers read and call. */
export type MouseLike = {
  button: number
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  preventDefault: () => void
}

/** Stops the browser's middle-button autoscroll (and its "open in new window" on links). */
export function preventMiddleMouseDown(e: MouseLike) {
  if (e.button === 1) e.preventDefault()
}

/** Handlers for a tab-like element: a middle click (auxclick, button 1) closes it without opening a browser tab. */
export function middleClickClose(onClose: () => void) {
  return {
    onMouseDown: preventMiddleMouseDown,
    onAuxClick: (e: MouseLike) => {
      if (e.button !== 1) return
      e.preventDefault()
      onClose()
    },
  }
}

/**
 * A plain left click, which the in-app router handles. Ctrl/Cmd/Shift/Alt-clicks and other buttons are left to the
 * browser (new tab or window), so they must not open an in-app tab.
 */
export function isPlainClick(e: MouseLike): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}
