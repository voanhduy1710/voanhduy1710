'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Fades its content in (opacity + a small upward slide) the first time it scrolls into view. Server HTML has no
 * hidden state, so without JS, in print and when it is already on screen at load, it simply shows. The hiding and
 * the transition live in globals.css under `prefers-reduced-motion: no-preference`, so reduced motion shows it as is.
 */
export function RevealOnView({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const r = el.getBoundingClientRect()
    if (r.top < window.innerHeight && r.bottom > 0) return
    el.dataset.reveal = 'hidden'
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.reveal = 'shown'
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
