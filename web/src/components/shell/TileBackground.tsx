'use client'

import { useEffect, useRef, useState } from 'react'
import { TILE, tileAt, tileGrid, type TileGrid } from './tileGrid'

type Tile = { duration: number; delay: number; warm: boolean; still: boolean }

/** Random per-tile timing, assigned once per build; negative delays start every tile mid-cycle. */
function makeTiles(count: number): Tile[] {
  return Array.from({ length: count }, () => {
    const duration = 30 + Math.random() * 25
    return { duration, delay: -Math.random() * duration, warm: Math.random() < 0.3, still: Math.random() < 0.13 }
  })
}

const RESIZE_DEBOUNCE_MS = 150

type TileState = { grid: TileGrid; tiles: Tile[] }

/**
 * The last grid built in this page session. An EN <-> VI switch mounts a new shell (the root layout is per
 * language); starting from this grid renders the tiles in the same commit as the rest of the shell, instead of an
 * empty frame, a forced layout and a second commit, and the pattern does not re-shuffle. Empty during hydration, so
 * the first client render still matches the server's (no tiles).
 */
let lastState: TileState | null = null

/**
 * Slanted grid of rounded tiles behind the editor; random tiles slowly light up and fade.
 * Performance: each tile's lit state is a pre-painted `::before` layer animated only with `opacity` by CSS
 * keyframes (no timers); the skew is applied once on the grid; the grid is rebuilt only on (debounced) resize;
 * animations pause while the tab is hidden. Hover lights the tile under the pointer, found by geometry because the
 * page content sits above the tiles. `prefers-reduced-motion`: a static lit pattern (see globals.css).
 */
export function TileBackground() {
  const areaRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<TileState | null>(() => lastState)
  const initial = useRef(state)

  useEffect(() => {
    if (state) lastState = state
  }, [state])

  // Build, and rebuild when the area's size changes the grid.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let current: TileGrid | undefined = initial.current?.grid
    const build = () => {
      const grid = tileGrid(area.clientWidth, area.clientHeight)
      if (current && current.cols === grid.cols && current.rows === grid.rows && current.scale === grid.scale) {
        if (current.left !== grid.left || current.top !== grid.top) setState((s) => (s ? { ...s, grid } : s))
        current = grid
        return
      }
      current = grid
      setState({ grid, tiles: makeTiles(grid.cols * grid.rows) })
    }
    build()
    const observer = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(build, RESIZE_DEBOUNCE_MS)
    })
    observer.observe(area)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  // Pause the keyframes while the tab is hidden.
  useEffect(() => {
    const sync = () => gridRef.current?.toggleAttribute('data-paused', document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [state])

  // Hover highlight: the pointer moves over the editor column (content above the tiles), at most once per frame.
  useEffect(() => {
    const area = areaRef.current
    const host = area?.parentElement
    if (!area || !host || !state) return
    let frame = 0
    let lit: Element | undefined
    let last: PointerEvent | undefined
    const set = (el: Element | undefined) => {
      if (el === lit) return
      lit?.classList.remove('is-hover')
      el?.classList.add('is-hover')
      lit = el
    }
    const update = () => {
      frame = 0
      if (!last) return
      const box = area.getBoundingClientRect()
      const index = tileAt(state.grid, last.clientX - box.left, last.clientY - box.top)
      set(index === undefined ? undefined : gridRef.current?.children[index])
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      last = e
      if (!frame) frame = requestAnimationFrame(update)
    }
    const onLeave = () => {
      last = undefined
      set(undefined)
    }
    host.addEventListener('pointermove', onMove, { passive: true })
    host.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      set(undefined)
    }
  }, [state])

  const grid = state?.grid
  return (
    <div ref={areaRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden print:hidden">
      {grid && state && (
        <div
          ref={gridRef}
          className="tile-grid"
          style={{
            left: grid.left,
            top: grid.top,
            width: grid.width,
            height: grid.height,
            gridTemplateColumns: `repeat(${grid.cols}, ${grid.tileWidth}px)`,
            gridAutoRows: `${grid.tileHeight}px`,
            gap: grid.gap,
            transform: `skewX(-${TILE.skewDeg}deg)`,
            ['--tile-radius' as string]: `${16 * grid.scale}px`,
          }}
        >
          {state.tiles.map((t, i) => (
            <div
              key={i}
              className={`tile${t.warm ? ' warm' : ''}${t.still ? ' still' : ''}`}
              style={{ ['--tile-dur' as string]: `${t.duration.toFixed(1)}s`, ['--tile-delay' as string]: `${t.delay.toFixed(1)}s` }}
            />
          ))}
        </div>
      )}
      {/* Static vignette: darkens the tiles behind the content (strongest left of centre, where the hero sits). */}
      <div className="tile-vignette absolute inset-0" />
    </div>
  )
}
