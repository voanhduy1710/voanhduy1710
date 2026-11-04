'use client'

import { useSyncExternalStore } from 'react'
import type { HomeSectionId } from '@/lib/sections'
import { elementInEditor, visibleEditor } from './editorPane'

/**
 * Which home section is in view (scroll-spy), shared by the home page's <SectionSpy> and the explorer, plus the
 * in-page scrolling used by section links. `null` = not on the home page.
 */
let active: HomeSectionId | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setActiveSection(id: HomeSectionId | null) {
  if (id === active) return
  active = id
  for (const l of listeners) l()
}

/** The section in view on the home page; `null` elsewhere (and during server render and hydration). */
export function useActiveSection(): HomeSectionId | null {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => null,
  )
}

/**
 * While a section link's scroll runs, the spy holds the clicked section instead of the ones scrolled past.
 * It keeps holding it after the scroll ends, until the reader scrolls across a section edge: a section near the end
 * of the page cannot reach the top of the pane, and would otherwise lose the highlight to the last one.
 */
let scrollingTo: HomeSectionId | null = null
export const isScrollingToSection = () => scrollingTo !== null

/** The section a link asked for while on another page; the home page scrolls to it when it mounts. */
let pending: HomeSectionId | null = null
export function setPendingSection(id: HomeSectionId) {
  pending = id
}
export function takePendingSection(): HomeSectionId | null {
  const id = pending
  pending = null
  return id
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Scrolls the editor pane to a home section (smooth, or instant under reduced motion / `instant`) and puts its id
 * in the URL hash without a navigation. The explorer highlight moves to it at once.
 */
export function scrollToSection(id: HomeSectionId, { instant = false } = {}) {
  const el = elementInEditor(id)
  if (!el) return
  const smooth = !instant && !reducedMotion()
  setActiveSection(id)
  if (`#${id}` !== window.location.hash) window.history.replaceState(null, '', `#${id}`)
  holdUntilScrollEnd(id)
  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'start' })
}

let release: (() => void) | undefined

function holdUntilScrollEnd(id: HomeSectionId) {
  release?.()
  const pane = visibleEditor()
  scrollingTo = id
  const done = () => {
    pane?.removeEventListener('scrollend', done)
    window.clearTimeout(timer)
    release = undefined
    scrollingTo = null
  }
  // `scrollend` is not fired when there is nothing to scroll; the timer is the fallback.
  const timer = window.setTimeout(done, 1200)
  pane?.addEventListener('scrollend', done)
  release = done
}
