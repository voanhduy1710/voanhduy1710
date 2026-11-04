// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixHand } from '@/components/home/MatrixHand'
import {
  angleAt,
  handGrid,
  LEVELS,
  levelStyle,
  maskTransform,
  SHAPE,
  TAIL,
  TILT_DEG,
  trail,
  WAVE_AMPLITUDE,
  WAVE_PERIOD_MS,
} from '@/components/home/matrixHandGeometry'

const tilt = (TILT_DEG * Math.PI) / 180

describe('angleAt', () => {
  it('starts at the −30° tilt and swings ±0.30 rad around it, continuously', () => {
    expect(angleAt(0)).toBeCloseTo(tilt)
    expect(angleAt(WAVE_PERIOD_MS / 4)).toBeCloseTo(tilt + WAVE_AMPLITUDE)
    expect(angleAt((3 * WAVE_PERIOD_MS) / 4)).toBeCloseTo(tilt - WAVE_AMPLITUDE)
    // never pauses: later cycles still swing
    expect(angleAt(5 * WAVE_PERIOD_MS + WAVE_PERIOD_MS / 4)).toBeCloseTo(tilt + WAVE_AMPLITUDE)
    expect(WAVE_PERIOD_MS).toBe(1500)
  })
  it('stays within the amplitude', () => {
    for (let t = 0; t < 5000; t += 37) expect(Math.abs(angleAt(t) - tilt)).toBeLessThanOrEqual(WAVE_AMPLITUDE + 1e-9)
  })
  it('is static without the wave (reduced motion) and honours a custom tilt', () => {
    expect(angleAt(250, false)).toBeCloseTo(tilt)
    expect(angleAt(0, true, 45)).toBeCloseTo(Math.PI / 4)
  })
})

describe('trail', () => {
  it('is 1 at the head, fades linearly over the tail, 0 ahead of the head and past the tail', () => {
    expect(trail(-0.01)).toBe(0)
    expect(trail(0)).toBe(1)
    expect(trail(0.99)).toBe(1)
    expect(trail(1)).toBeCloseTo(1 - 1 / TAIL)
    expect(trail(7)).toBeCloseTo(0.5)
    expect(trail(TAIL - 0.001)).toBeCloseTo(0, 3)
    expect(trail(TAIL)).toBe(0)
  })
})

describe('handGrid', () => {
  it('uses ~64 columns with cell aspect 1.25 on large canvases', () => {
    const g = handGrid(220)
    expect(g.cellW).toBeCloseTo(220 / 64)
    expect(g.cellH).toBeCloseTo(g.cellW * 1.25)
    expect(g.cols).toBe(64)
    expect(g.rows).toBe(Math.floor(220 / g.cellH))
    expect(g.fontPx).toBeCloseTo(g.cellH * 0.95, 2)
  })
  it('keeps cells at least 2.2 px wide on small canvases', () => {
    const g = handGrid(96)
    expect(g.cellW).toBe(2.2)
    expect(g.cols).toBe(43)
    expect(g.rows).toBe(34)
  })
  it('never returns an empty grid', () => {
    expect(handGrid(0)).toMatchObject({ cols: 1, rows: 1 })
  })
})

describe('maskTransform and levelStyle', () => {
  it('puts the wrist pivot at (w/2, 0.88h) and scales to 78% of the shorter side', () => {
    expect(maskTransform(40, 30)).toEqual({ x: 20, y: 30 * 0.88, k: (30 / SHAPE) * 0.78 })
  })
  it('matches the mockup brightness formula', () => {
    expect(levelStyle(0)).toBe('rgba(150,150,150,0.300)')
    expect(levelStyle(LEVELS / 2)).toBe('rgba(195,195,195,0.650)')
    expect(levelStyle(LEVELS)).toBe('rgba(255,255,255,1.000)')
  })
})

describe('<MatrixHand>', () => {
  beforeEach(() => {
    const ctx = new Proxy(
      {
        getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }),
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: vi.fn(),
      },
      { get: (t, k) => (k in t ? t[k as keyof typeof t] : () => {}), set: () => true },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 96, height: 96 } as DOMRect)
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('mounts, is decorative and hidden in print', () => {
    const { container, unmount } = render(<MatrixHand className="size-[1.4em]" />)
    const canvas = container.querySelector('canvas')!
    expect(canvas.getAttribute('aria-hidden')).toBe('true')
    expect(canvas.className).toMatch(/print:hidden/)
    expect(canvas.className).toMatch(/size-\[1\.4em\]/)
    expect(canvas.width).toBe(96)
    // first frame drawn: digits copied into the frame buffer, which is put (the mocked context is shared with the
    // silhouette canvas, whose thresholded image is put too)
    const ctx = canvas.getContext('2d') as unknown as { putImageData: ReturnType<typeof vi.fn> }
    const calls = ctx.putImageData.mock.calls
    const img = calls[calls.length - 1][0] as ImageData
    expect(img.data.length).toBe(96 * 96 * 4)
    expect(img.data.some((v) => v > 0)).toBe(true)
    expect(() => unmount()).not.toThrow()
  })

  it('does not throw when canvas is unsupported', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(() => render(<MatrixHand />)).not.toThrow()
  })
})
