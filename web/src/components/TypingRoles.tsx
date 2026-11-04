'use client'

import { useEffect, useRef } from 'react'

const TYPE_MS = 70
const DELETE_MS = 35
const HOLD_MS = 1500
const NEXT_MS = 300

/**
 * Types each role, holds it, deletes it, moves to the next. Writes the text node directly (no React render per
 * letter). With `prefers-reduced-motion: reduce` the first role stays still and the caret does not blink.
 * Screen readers get the full list once, not the typing.
 */
export function TypingRoles({ roles }: { roles: string[] }) {
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = textRef.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!el || roles.length === 0) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let word = 0
    let length = roles[0].length
    let deleting = true

    const step = () => {
      const role = roles[word]
      el.textContent = role.slice(0, length)
      if (!deleting && length < role.length) {
        length++
        timer = setTimeout(step, TYPE_MS)
      } else if (!deleting) {
        deleting = true
        timer = setTimeout(step, HOLD_MS)
      } else if (length > 0) {
        length--
        timer = setTimeout(step, DELETE_MS)
      } else {
        deleting = false
        word = (word + 1) % roles.length
        timer = setTimeout(step, NEXT_MS)
      }
    }
    const start = () => {
      clearTimeout(timer)
      el.textContent = roles[0]
      word = 0
      length = roles[0].length
      deleting = true
      if (!motion.matches && roles.length > 0) timer = setTimeout(step, HOLD_MS)
    }
    start()
    motion.addEventListener('change', start)
    return () => {
      clearTimeout(timer)
      motion.removeEventListener('change', start)
    }
  }, [roles])

  return (
    <>
      <span className="sr-only">{roles.join(', ')}</span>
      <span aria-hidden className="text-vsc-teal">
        <span ref={textRef}>{roles[0]}</span>
        <span className="hero-caret ml-[2px] inline-block h-[1.1em] w-px bg-vsc-teal align-[-0.15em]" />
      </span>
    </>
  )
}
