import { describe, expect, it } from 'vitest'
import { MAX_TILES, TILE, tileAt, tileGrid } from '@/components/shell/tileGrid'

const tan = Math.tan((TILE.skewDeg * Math.PI) / 180)

/** After the skew, the grid still covers every corner of the area. */
function covers(width: number, height: number) {
  const g = tileGrid(width, height)
  const shift = tan * (g.height / 2)
  expect(g.top).toBeLessThanOrEqual(0)
  expect(g.top + g.height).toBeGreaterThanOrEqual(height)
  // Top edge is shifted right by `shift`, bottom edge left by `shift` (skewX(-a)).
  expect(g.left + shift).toBeLessThanOrEqual(0)
  expect(g.left + g.width - shift).toBeGreaterThanOrEqual(width)
  return g
}

describe('tileGrid', () => {
  it('stays within MAX_TILES for a 1920×1080 viewport, sidebar open or closed', () => {
    for (const [w, h] of [
      [1580, 982],
      [1870, 982],
      [1920, 1080],
    ]) {
      const g = covers(w, h)
      expect(g.cols * g.rows).toBeLessThanOrEqual(MAX_TILES)
    }
  })

  it('keeps the mockup tile size when it fits, and enlarges tiles only when needed', () => {
    expect(tileGrid(1150, 800).scale).toBe(1)
    const huge = covers(3840, 2000)
    expect(huge.scale).toBeGreaterThan(1)
    expect(huge.cols * huge.rows).toBeLessThanOrEqual(MAX_TILES)
  })

  it('covers a phone-sized area with few tiles', () => {
    const g = covers(340, 760)
    expect(g.cols * g.rows).toBeLessThan(40)
  })
})

describe('tileAt', () => {
  const g = tileGrid(1200, 800)
  const centreOf = (row: number, col: number) => {
    const gx = col * (g.tileWidth + g.gap) + g.tileWidth / 2
    const gy = row * (g.tileHeight + g.gap) + g.tileHeight / 2
    return { x: gx + g.left - tan * (gy - g.height / 2), y: gy + g.top }
  }

  it('finds the tile under a point, undoing the skew', () => {
    for (const [row, col] of [
      [0, 0],
      [1, 3],
      [g.rows - 1, g.cols - 1],
    ]) {
      const { x, y } = centreOf(row, col)
      expect(tileAt(g, x, y)).toBe(row * g.cols + col)
    }
  })

  it('returns undefined over a gap or outside the grid', () => {
    const { x, y } = centreOf(1, 1)
    expect(tileAt(g, x + g.tileWidth / 2 + g.gap / 2, y)).toBeUndefined()
    expect(tileAt(g, x, g.top - 5)).toBeUndefined()
  })
})
