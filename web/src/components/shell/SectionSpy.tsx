'use client'

import { useEffect } from 'react'
import { activeSection, HOME_SECTIONS, sectionFromHash } from '@/lib/sections'
import { elementInEditor, visibleEditor } from './editorPane'
import { takeRestoredFlag } from './readingPosition'
import { isScrollingToSection, scrollToSection, setActiveSection, takePendingSection } from './sectionScroll'

/**
 * Scroll-spy for the home page, rendered once at its end (the element is the end-of-page sentinel). Two
 * IntersectionObservers on the editor pane tell it when to look: one with a thin band at the reading line (a third
 * down the pane) watching the sections, one watching this sentinel (page end in view). On each change it picks the
 * active section from the section tops. On mount it scrolls to the section asked for by a link or the URL hash.
 */
export function SectionSpy() {
  useEffect(() => {
    const pane = visibleEditor()
    const sections = HOME_SECTIONS.map((id) => elementInEditor(id)).filter((el): el is HTMLElement => el !== null)
    const sentinel = elementInEditor('home-end')
    if (!pane || sections.length === 0 || !sentinel) return

    let endInView = false
    const update = () => {
      if (isScrollingToSection()) return
      const paneTop = pane.getBoundingClientRect().top
      const tops = sections.map((el) => ({ id: el.id as (typeof HOME_SECTIONS)[number], top: el.getBoundingClientRect().top - paneTop }))
      setActiveSection(activeSection(tops, { height: pane.clientHeight, atBottom: endInView }) ?? null)
    }

    const band = new IntersectionObserver(update, { root: pane, rootMargin: '-33.333% 0px -66.666% 0px' })
    const end = new IntersectionObserver(
      (entries) => {
        endInView = entries[entries.length - 1].isIntersecting
        update()
      },
      { root: pane },
    )
    for (const el of sections) band.observe(el)
    end.observe(sentinel)

    // The observers' first callbacks set the initial highlight (after this scroll, if there is one).
    // A language switch just restored the reader's place: that wins over the hash / a pending section.
    const restored = takeRestoredFlag()
    const target = takePendingSection() ?? sectionFromHash(window.location.hash)
    if (target && !restored) scrollToSection(target, { instant: true })

    return () => {
      band.disconnect()
      end.disconnect()
      setActiveSection(null)
    }
  }, [])

  return <div id="home-end" aria-hidden className="h-px" />
}
