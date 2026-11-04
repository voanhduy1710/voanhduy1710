'use client'

import { useEffect, useRef } from 'react'
import {
  angleAt,
  DIGITS,
  FLICKER,
  HAND_PALM,
  HAND_QUALITY,
  HAND_STROKES,
  HAND_WRIST,
  handGrid,
  initialHandQuality,
  LEVELS,
  levelStyle,
  maskTransform,
  median,
  nextHandQuality,
  PIVOT,
  QUALITY_WINDOW,
  SHAPE,
  SHAPE_BLUR,
  STREAMS_PER_COLUMN,
  TAIL,
  trail,
} from './matrixHandGeometry'

const FONT_STACK = 'Consolas, "Cascadia Code", ui-monospace, monospace'

let shapeCache: HTMLCanvasElement | null | undefined

/** The hand silhouette (white on transparent, SHAPE×SHAPE), rasterised once per page and shared. */
function handShape(): HTMLCanvasElement | null {
  if (shapeCache !== undefined) return shapeCache
  const raw = document.createElement('canvas')
  const shape = document.createElement('canvas')
  raw.width = raw.height = shape.width = shape.height = SHAPE
  const g = raw.getContext('2d')
  const sg = shape.getContext('2d', { willReadFrequently: true })
  if (!g || !sg) return (shapeCache = null)
  const S = SHAPE / 200
  g.fillStyle = g.strokeStyle = '#fff'
  g.lineCap = 'round'
  const rect = ([x, y, w, h, r]: readonly number[]) => {
    g.beginPath()
    g.roundRect(x * S, y * S, w * S, h * S, r * S)
    g.fill()
  }
  rect(HAND_PALM)
  for (const [w, x1, y1, x2, y2] of HAND_STROKES) {
    g.lineWidth = w * S
    g.beginPath()
    g.moveTo(x1 * S, y1 * S)
    g.lineTo(x2 * S, y2 * S)
    g.stroke()
  }
  rect(HAND_WRIST)
  sg.filter = `blur(${SHAPE_BLUR * S}px)`
  sg.drawImage(raw, 0, 0)
  sg.filter = 'none'
  const img = sg.getImageData(0, 0, SHAPE, SHAPE)
  const d = img.data
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 128 ? 255 : 0
  sg.putImageData(img, 0, 0)
  return (shapeCache = shape)
}

const STYLES = Array.from({ length: LEVELS + 1 }, (_, i) => levelStyle(i))
const randomDigit = () => (Math.random() * 10) | 0

/**
 * Decorative waving hand made of mono "digital rain" (digits 0–9), next to the name in the hero; a port of the
 * approved mockup (`.superpowers/mockups/matrix-hand.html`). Sized by CSS (1.4em of the heading).
 * Performance: one canvas, DPR capped at 2, rAF throttled to ~30 fps and stopped while the tab is hidden or the
 * canvas is off-screen; the silhouette is rasterised once and the digits
 * are copied from a glyph atlas built on resize into one buffer; per frame only the tiny cols×rows mask is read back.
 * `prefers-reduced-motion`: one static frame (no wave, no falling rain).
 */
export function MatrixHand({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    // CPU-backed: the frame is written with putImageData, which is cheapest on a software canvas.
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const mask = document.createElement('canvas')
    const mctx = mask.getContext('2d', { willReadFrequently: true })
    let shape: HTMLCanvasElement | null = null
    try {
      shape = handShape()
    } catch (e) {
      shapeCache = null
      if (process.env.NODE_ENV !== 'production') console.error('MatrixHand: setup failed', e)
      return
    }
    if (!ctx || !mctx || !shape) return

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let css = 0
    let dpr = 1
    let grid = handGrid(1)
    let glyph = new Uint8Array(0)
    let heads = new Float32Array(0)
    let speed = new Float32Array(0)
    // Glyph atlas: every digit at every brightness level, pre-rendered (same font and fill styles) on resize and
    // read back once. A frame copies sprites from it into one pixel buffer (also allocated on resize) and puts that
    // with a single putImageData, instead of ~1–2k fillText/drawImage calls.
    const atlas = document.createElement('canvas')
    const actx = atlas.getContext('2d', { willReadFrequently: true })
    if (!actx) return
    let sw = 1
    let sh = 1
    let atlasPx = new Uint32Array(0)
    let out: ImageData | null = null
    let outPx = new Uint32Array(0)
    let raf = 0
    let last = -Infinity
    let onScreen = true
    // Adaptive quality (see HAND_QUALITY): the draw time is measured over a window of draws; a slow device drops to a
    // 15 fps redraw, then to fewer streams, and comes back when drawing is cheap again.
    const hints = navigator as Navigator & { deviceMemory?: number }
    let level = initialHandQuality({ hardwareConcurrency: hints.hardwareConcurrency, deviceMemory: hints.deviceMemory })
    let streamsNow = HAND_QUALITY[level].streams
    const costs: number[] = []
    let warmUp = true
    canvas.dataset.quality = String(level)

    // An exception while drawing leaves the canvas blank instead of breaking the page (logged once, in dev only).
    let failed = false
    const fail = (e: unknown) => {
      if (!failed && process.env.NODE_ENV !== 'production') console.error('MatrixHand: drawing failed', e)
      failed = true
      cancelAnimationFrame(raf)
      raf = 0
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      } catch {
        // Nothing left to clear.
      }
    }

    const draw = (t: number) => {
      const { cols, rows, cellW, cellH } = grid
      const m = maskTransform(cols, rows)
      mctx.setTransform(1, 0, 0, 1, 0, 0)
      mctx.clearRect(0, 0, cols, rows)
      mctx.translate(m.x, m.y)
      mctx.rotate(angleAt(t, !reduce))
      mctx.scale(m.k, m.k)
      mctx.drawImage(shape, -PIVOT.x, -PIVOT.y)
      const a = mctx.getImageData(0, 0, cols, rows).data

      if (!out) return
      const W = canvas.width
      const H = canvas.height
      const aw = atlas.width
      outPx.fill(0)
      if (!reduce) {
        for (let s = 0; s < heads.length; s++) {
          heads[s] += speed[s]
          if (heads[s] > rows + TAIL) heads[s] = -Math.random() * rows * 0.6
        }
      }
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const i = r * cols + c
          if (a[i * 4 + 3] < 128) continue
          if (!reduce && Math.random() < FLICKER) glyph[i] = randomDigit()
          let k = 0
          for (let s = 0; s < streamsNow; s++) k = Math.max(k, trail(heads[c + s * cols] - r))
          const sx = glyph[i] * sw
          const sy = Math.round(k * LEVELS) * sh
          const dx = Math.round((c * cellW + cellW / 2) * dpr - sw / 2)
          const dy = Math.round((r * cellH + cellH / 2) * dpr - sh / 2)
          for (let py = 0; py < sh; py++) {
            const y = dy + py
            if (y < 0 || y >= H) continue
            const src = (sy + py) * aw + sx
            const dst = y * W + dx
            for (let px = 0; px < sw; px++) {
              const x = dx + px
              if (x < 0 || x >= W) continue
              // Sprites only overlap in their transparent padding: keep the more opaque pixel (alpha = top byte).
              const v = atlasPx[src + px]
              if (v >>> 24 > outPx[dst + px] >>> 24) outPx[dst + px] = v
            }
          }
        }
      }
      ctx.putImageData(out, 0, 0)
    }

    const frame = (t: number) => {
      if (failed) return
      raf = requestAnimationFrame(frame)
      try {
        step(t)
      } catch (e) {
        fail(e)
      }
    }
    const step = (t: number) => {
      if (t - last < HAND_QUALITY[level].frameMs - 2) return
      last = t
      const start = performance.now()
      draw(t)
      costs.push(performance.now() - start)
      if (costs.length >= QUALITY_WINDOW) {
        const cost = median(costs)
        costs.length = 0
        // The first window runs while the page is still loading (JIT, GC): not representative.
        if (warmUp) {
          warmUp = false
          return
        }
        canvas.dataset.drawMs = cost.toFixed(1)
        const next = nextHandQuality(level, cost)
        if (next !== level) {
          level = next
          streamsNow = HAND_QUALITY[level].streams
          canvas.dataset.quality = String(level)
        }
      }
    }
    const sync = () => {
      const run = !failed && !reduce && css > 0 && onScreen && !document.hidden
      if (run && !raf) raf = requestAnimationFrame(frame)
      else if (!run && raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    const resize = () => {
      if (failed) return
      try {
        layout()
      } catch (e) {
        fail(e)
      }
    }
    const layout = () => {
      const size = Math.round(canvas.getBoundingClientRect().width)
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      if (size === css && ratio === dpr) return
      css = size
      dpr = ratio
      if (css <= 0) return sync()
      canvas.width = Math.round(css * dpr)
      canvas.height = Math.round(css * dpr)
      grid = handGrid(css)
      mask.width = grid.cols
      mask.height = grid.rows
      const streams = grid.cols * STREAMS_PER_COLUMN
      glyph = Uint8Array.from({ length: grid.cols * grid.rows }, randomDigit)
      heads = Float32Array.from({ length: streams }, () => Math.random() * grid.rows * 1.4 - grid.rows * 0.4)
      speed = Float32Array.from({ length: streams }, () => 0.35 + Math.random() * 0.8)
      sw = Math.ceil(grid.cellW * dpr) + 2
      sh = Math.ceil(grid.cellH * dpr) + 2
      atlas.width = sw * DIGITS.length
      atlas.height = sh * (LEVELS + 1)
      actx.font = `600 ${grid.fontPx * dpr}px ${FONT_STACK}`
      actx.textAlign = 'center'
      actx.textBaseline = 'middle'
      for (let l = 0; l <= LEVELS; l++) {
        actx.fillStyle = STYLES[l]
        for (let d = 0; d < DIGITS.length; d++) actx.fillText(DIGITS[d], d * sw + sw / 2, l * sh + sh / 2)
      }
      atlasPx = new Uint32Array(actx.getImageData(0, 0, atlas.width, atlas.height).data.buffer)
      out = ctx.createImageData(canvas.width, canvas.height)
      outPx = new Uint32Array(out.data.buffer)
      draw(performance.now())
      sync()
    }

    resize()
    const ro = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    ro?.observe(canvas)
    const io =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver((entries) => {
            onScreen = entries[entries.length - 1].isIntersecting
            sync()
          })
    io?.observe(canvas)
    document.addEventListener('visibilitychange', sync)
    return () => {
      cancelAnimationFrame(raf)
      raf = 0
      ro?.disconnect()
      io?.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className={`matrix-hand pointer-events-none block print:hidden ${className}`} />
}
