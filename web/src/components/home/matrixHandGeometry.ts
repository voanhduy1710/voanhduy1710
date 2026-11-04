/**
 * Pure geometry and timing for the hero's "matrix hand" (ported from the approved mockup
 * `.superpowers/mockups/matrix-hand.html`, v3). No DOM access here, so it is safe to import on the server.
 */

/** The silhouette is drawn in a 200×200 design space and rasterised once at SHAPE×SHAPE px. */
export const SHAPE = 400
const S = SHAPE / 200

/** Blur radius (design units) before the alpha threshold, which turns finger/palm joins into smooth fillets. */
export const SHAPE_BLUR = 3.2

/** Round-capped strokes in design units: [width, x1, y1, x2, y2]. */
export const HAND_STROKES: readonly (readonly [number, number, number, number, number])[] = [
  [21, 76, 112, 66, 40], // index
  [22, 99, 108, 97, 26], // middle
  [21, 121, 110, 128, 36], // ring
  [18, 140, 120, 152, 66], // little
  [23, 84, 150, 36, 118], // thumb, out to the left and slightly up
]

/** Rounded rectangles in design units: [x, y, w, h, radius]. */
export const HAND_PALM = [62, 88, 86, 88, 36] as const
export const HAND_WRIST = [80, 160, 52, 34, 14] as const

/** Wrist pivot, in SHAPE px. */
export const PIVOT = { x: 106 * S, y: 190 * S } as const

/** Default tilt of the hand. */
export const TILT_DEG = -30

/** Wave: continuous, never pauses; ±0.30 rad around the tilt with a WAVE_PERIOD_MS period. */
export const WAVE_AMPLITUDE = 0.3
export const WAVE_PERIOD_MS = 1500

/** Rain: digits, 12 streams per column, tail length in rows, chance a visible glyph changes per frame. */
export const DIGITS = '0123456789'
export const STREAMS_PER_COLUMN = 12
export const TAIL = 14
export const FLICKER = 0.12

/** Frame cap (~30 fps). */
export const FRAME_MS = 1000 / 30

/** Hand rotation (radians) at time `ms`; `wave: false` (reduced motion) gives the static tilt. */
export function angleAt(ms: number, wave = true, tiltDeg = TILT_DEG): number {
  const w = wave ? Math.sin((ms / WAVE_PERIOD_MS) * Math.PI * 2) * WAVE_AMPLITUDE : 0
  return (tiltDeg * Math.PI) / 180 + w
}

/** Brightness of a cell `d` rows behind a stream head: 1 at the head, fading linearly over TAIL rows, else 0. */
export function trail(d: number): number {
  return d >= 0 && d < 1 ? 1 : d >= 1 && d < TAIL ? 1 - d / TAIL : 0
}

export type HandGrid = { cellW: number; cellH: number; cols: number; rows: number; fontPx: number }

/** Rain grid for a square canvas of `css` px: ~64 columns (cells at least 2.2 px wide), cell aspect 1.25. */
export function handGrid(css: number): HandGrid {
  const cellW = Math.max(2.2, css / 64)
  const cellH = cellW * 1.25
  return {
    cellW,
    cellH,
    cols: Math.max(1, Math.floor(css / cellW)),
    rows: Math.max(1, Math.floor(css / cellH)),
    fontPx: Number((cellH * 0.95).toFixed(2)),
  }
}

/** Placement of the silhouette in a w×h mask: pivot at (w/2, 0.88h), scaled to 78% of the shorter side. */
export function maskTransform(w: number, h: number): { x: number; y: number; k: number } {
  return { x: w / 2, y: h * 0.88, k: (Math.min(w, h) / SHAPE) * 0.78 }
}

/** Number of brightness steps the per-cell colour is quantised to (styles are pre-built, no per-frame strings). */
export const LEVELS = 100

/** Fill style for brightness level `i` of LEVELS: near-white head, grey tail, alpha 0.30–1. */
export function levelStyle(i: number): string {
  const k = i / LEVELS
  const v = k > 0.93 ? 255 : Math.round(150 + k * 90)
  return `rgba(${v},${v},${v},${(0.3 + k * 0.7).toFixed(3)})`
}

/**
 * Adaptive quality. Level 0 is the owner's look (30 fps, 12 streams per column); a slow device steps down to a
 * 15 fps redraw, then to 8 streams per column. The wave never stops (only reduced motion freezes it).
 */
export type HandQuality = { frameMs: number; streams: number }
export const HAND_QUALITY: readonly HandQuality[] = [
  { frameMs: FRAME_MS, streams: STREAMS_PER_COLUMN },
  { frameMs: 1000 / 15, streams: STREAMS_PER_COLUMN },
  { frameMs: 1000 / 15, streams: 8 },
]
/** A draw (median over the window) above this many ms steps quality down. */
export const DRAW_BUDGET_MS = 6
/**
 * Stepping back up needs the predicted draw at the higher level under this share of the budget, so it does not flip
 * back and forth. A draw costs about the same at 15 and 30 fps (only how often it runs changes); more streams cost
 * roughly in proportion (an over-estimate: the mask read and the final put do not grow).
 */
export const STEP_UP_SHARE = 0.8
/** Draws per measurement window (~1 s at 30 fps, ~2 s at 15 fps). The first window after a start is a warm-up. */
export const QUALITY_WINDOW = 30

/** Starting level from device hints: 4 cores or fewer, or 4 GB of memory or less, start at a 15 fps redraw. */
export function initialHandQuality(hints: { hardwareConcurrency?: number; deviceMemory?: number }): number {
  const weak =
    (hints.hardwareConcurrency !== undefined && hints.hardwareConcurrency > 0 && hints.hardwareConcurrency <= 4) ||
    (hints.deviceMemory !== undefined && hints.deviceMemory <= 4)
  return weak ? 1 : 0
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * The level after a window whose median draw took `medianMs`: one step down if over budget; one step up if the
 * predicted draw at the higher level stays clearly under it; else unchanged.
 */
export function nextHandQuality(level: number, medianMs: number): number {
  if (medianMs > DRAW_BUDGET_MS) return Math.min(level + 1, HAND_QUALITY.length - 1)
  if (level === 0) return 0
  const predicted = medianMs * (HAND_QUALITY[level - 1].streams / HAND_QUALITY[level].streams)
  return predicted < DRAW_BUDGET_MS * STEP_UP_SHARE ? level - 1 : level
}
