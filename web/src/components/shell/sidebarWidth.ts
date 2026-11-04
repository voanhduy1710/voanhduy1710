/**
 * Width of the desktop explorer, set by dragging its right edge. The CSS variable `--sidebar-w` (on <html>) holds the
 * user's width in px; unset means the default (`--ui-sidebar`). The stylesheet clamps it the same way as here, so a
 * stored width larger than a later, narrower window still fits.
 */

export const SIDEBAR_WIDTH_KEY = 'vsc-sidebar-width'
export const SIDEBAR_WIDTH_VAR = '--sidebar-w'
export const SIDEBAR_MIN = 170
export const SIDEBAR_MAX = 560
/** ←/→ on the focused handle. */
export const SIDEBAR_KEY_STEP = 16

/** The widest the explorer may be in a window `viewport` px wide: half of it, and never more than 560px. */
export const maxSidebarWidth = (viewport: number) => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Math.floor(viewport / 2)))

/** `width` rounded and kept within [170, maxSidebarWidth(viewport)]. */
export function clampSidebarWidth(width: number, viewport: number): number {
  return Math.min(maxSidebarWidth(viewport), Math.max(SIDEBAR_MIN, Math.round(width)))
}

/** The width after an arrow key, or undefined for any other key. */
export function keyedSidebarWidth(key: string, width: number, viewport: number): number | undefined {
  if (key === 'ArrowLeft') return clampSidebarWidth(width - SIDEBAR_KEY_STEP, viewport)
  if (key === 'ArrowRight') return clampSidebarWidth(width + SIDEBAR_KEY_STEP, viewport)
  return undefined
}

/**
 * Inline script run before the first paint: applies the stored width so the explorer does not jump after hydration.
 * Kept tiny and self-contained (it is a string, not bundled code).
 */
export const SIDEBAR_WIDTH_BOOT = `try{var w=localStorage.getItem(${JSON.stringify(SIDEBAR_WIDTH_KEY)});if(w&&/^\\d{2,4}$/.test(w))document.documentElement.style.setProperty(${JSON.stringify(SIDEBAR_WIDTH_VAR)},w+'px')}catch(e){}`
