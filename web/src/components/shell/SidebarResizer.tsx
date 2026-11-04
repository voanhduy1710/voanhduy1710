'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  clampSidebarWidth,
  keyedSidebarWidth,
  maxSidebarWidth,
  SIDEBAR_MIN,
  SIDEBAR_WIDTH_KEY,
  SIDEBAR_WIDTH_VAR,
} from './sidebarWidth'

const root = () => document.documentElement.style

function store(width: number | undefined) {
  try {
    if (width === undefined) localStorage.removeItem(SIDEBAR_WIDTH_KEY)
    else localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width))
  } catch {
    // storage disabled: the width just is not kept
  }
}

/**
 * VS Code's sash on the explorer's right edge (desktop only): drag to resize, double-click to reset, ←/→ when focused.
 * While dragging only the `--sidebar-w` CSS variable changes, at most once per animation frame; the width is stored
 * in localStorage when the drag ends.
 */
export function SidebarResizer({ label, sidebar }: { label: string; sidebar: () => HTMLElement | null }) {
  const [width, setWidth] = useState<number>()
  const [max, setMax] = useState<number>()
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ startX: number; startWidth: number; width: number; frame: number }>(undefined)

  const current = () => sidebar()?.getBoundingClientRect().width ?? SIDEBAR_MIN

  // The pre-paint script already applied the stored width (and CSS clamps it to the window): read the rendered
  // width back for aria-valuenow, now and whenever the window is resized.
  useEffect(() => {
    const measure = () => {
      setWidth(Math.round(current()))
      setMax(maxSidebarWidth(window.innerWidth))
    }
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])

  const apply = (w: number) => root().setProperty(SIDEBAR_WIDTH_VAR, `${w}px`)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const startWidth = current()
    drag.current = { startX: e.clientX, startWidth, width: startWidth, frame: 0 }
    setDragging(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    d.width = clampSidebarWidth(d.startWidth + e.clientX - d.startX, window.innerWidth)
    if (!d.frame) {
      d.frame = requestAnimationFrame(() => {
        d.frame = 0
        apply(d.width)
      })
    }
  }

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    drag.current = undefined
    if (d.frame) cancelAnimationFrame(d.frame)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
    if (d.width === d.startWidth) return
    apply(d.width)
    store(d.width)
    setWidth(d.width)
  }

  const reset = () => {
    root().removeProperty(SIDEBAR_WIDTH_VAR)
    store(undefined)
    // the default width is CSS-defined: read it back after the style change
    requestAnimationFrame(() => setWidth(Math.round(current())))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = keyedSidebarWidth(e.key, width ?? current(), window.innerWidth)
    if (next === undefined) return
    e.preventDefault()
    apply(next)
    store(next)
    setWidth(next)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
      className="group absolute inset-y-0 -right-[2px] z-20 hidden w-[4px] cursor-col-resize touch-none focus-visible:outline-none md:block"
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-[1px] w-[2px] transition-colors duration-100 group-hover:bg-vsc-accent group-focus-visible:bg-vsc-accent motion-reduce:transition-none ${
          dragging ? 'bg-vsc-accent' : 'bg-transparent'
        }`}
      />
    </div>
  )
}
