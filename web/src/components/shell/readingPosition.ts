/**
 * Keeps the reader's place across the EN <-> VI switch. The two languages' texts have different heights, so a raw
 * scrollTop would land somewhere else: on the home page the place is "section id + how far into that section" (a
 * fraction of the section's height); on other pages it is a fraction of the scrollable height. The switch stores it
 * in sessionStorage for the target path; the new page restores it before it is painted.
 */

import { visibleEditor } from './editorPane'

export type SectionBox = { id: string; top: number; height: number }
export type ReadingPosition = { section?: string; fraction: number }
type Stored = ReadingPosition & { path: string; at: number }

export const READING_POSITION_KEY = 'vsc-lang-switch-position'
/** A stored position older than this is ignored (the click's navigation never happened). */
const MAX_AGE_MS = 15_000

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

/**
 * Where the top of the pane is: the last section starting at or above `scrollTop` (section tops in scroll
 * coordinates), and the fraction of its height scrolled past. Without sections: fraction of the scrollable height.
 */
export function positionOf(scrollTop: number, scrollable: number, sections: readonly SectionBox[]): ReadingPosition {
  const current = [...sections].reverse().find((s) => s.top <= scrollTop + 1) ?? sections[0]
  if (!current) return { fraction: scrollable > 0 ? clamp01(scrollTop / scrollable) : 0 }
  return { section: current.id, fraction: current.height > 0 ? clamp01((scrollTop - current.top) / current.height) : 0 }
}

/** The scrollTop for a stored position on the new page (falls back to the page fraction if the section is gone). */
export function scrollTopFor(pos: ReadingPosition, scrollable: number, sections: readonly SectionBox[]): number {
  const s = pos.section === undefined ? undefined : sections.find((x) => x.id === pos.section)
  const top = s ? s.top + clamp01(pos.fraction) * s.height : clamp01(pos.fraction) * scrollable
  return Math.round(Math.min(Math.max(0, top), Math.max(0, scrollable)))
}

/** Serialises a position for `path`; `parseStored` gives it back only for that path and only while fresh. */
export function serialize(pos: ReadingPosition, path: string, now: number): string {
  return JSON.stringify({ ...pos, path, at: now } satisfies Stored)
}

export function parseStored(raw: string | null, path: string, now: number): ReadingPosition | undefined {
  if (!raw) return undefined
  try {
    const s = JSON.parse(raw) as Partial<Stored>
    if (s.path !== path || typeof s.at !== 'number' || now - s.at > MAX_AGE_MS || now < s.at) return undefined
    if (typeof s.fraction !== 'number') return undefined
    return typeof s.section === 'string' ? { section: s.section, fraction: s.fraction } : { fraction: s.fraction }
  } catch {
    return undefined
  }
}

/* ---------------------------------------------------------------------------------------------
 * DOM side (the editor pane is `#editor`; home sections are `section[id]` children of the page article).
 * ------------------------------------------------------------------------------------------- */

const pane = (): HTMLElement | undefined => visibleEditor()

function sectionBoxes(el: HTMLElement, ids: readonly string[]): SectionBox[] {
  const paneTop = el.getBoundingClientRect().top
  return ids.flatMap((id) => {
    const s = el.querySelector<HTMLElement>(`[id="${id}"]`)
    if (!s) return []
    const r = s.getBoundingClientRect()
    return [{ id, top: r.top - paneTop + el.scrollTop, height: r.height }]
  })
}

/** Stores where the reader is, for the page at `targetPath` (called just before the language switch navigates). */
export function saveReadingPosition(targetPath: string, sectionIds: readonly string[]): void {
  const el = pane()
  if (!el) return
  const pos = positionOf(el.scrollTop, el.scrollHeight - el.clientHeight, sectionBoxes(el, sectionIds))
  try {
    sessionStorage.setItem(READING_POSITION_KEY, serialize(pos, targetPath, Date.now()))
  } catch {
    // storage unavailable (private mode quota): the switch still works, from the top
  }
}

let restored = false
/** True once, right after a restore: the home page's hash / pending-section scroll must not override it. */
export function takeRestoredFlag(): boolean {
  const r = restored
  restored = false
  return r
}

/** Restores a position stored for the current path (instant, no smooth scroll). Returns whether it did. */
export function restoreReadingPosition(sectionIds: readonly string[], path: string): boolean {
  const el = pane()
  if (!el) return false
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(READING_POSITION_KEY)
    sessionStorage.removeItem(READING_POSITION_KEY)
  } catch {
    return false
  }
  const pos = parseStored(raw, path.replace(/\/$/, '') || '/', Date.now())
  if (!pos) return false
  el.scrollTo({ top: scrollTopFor(pos, el.scrollHeight - el.clientHeight, sectionBoxes(el, sectionIds)), behavior: 'instant' })
  restored = true
  return true
}
