/** Geometry of the slanted tile background (sizes in CSS px, from the shell-v2 mockup). */
export const TILE = { width: 96, height: 160, gap: 10, skewDeg: 14 } as const

/** Upper bound on tile nodes, whatever the viewport (the performance contract allows ≤ 120 at 1920×1080). */
export const MAX_TILES = 120

/** Share of a tile's height the grid starts above the top edge, so the first row is cut like in the mockup. */
const TOP_CUT = 0.4

export type TileGrid = {
  cols: number
  rows: number
  /** Multiplier on tile size and gap; > 1 only when the default size would need more than MAX_TILES. */
  scale: number
  tileWidth: number
  tileHeight: number
  gap: number
  /** Grid box before the skew, positioned relative to the area's top-left corner. */
  left: number
  top: number
  width: number
  height: number
}

function layout(areaWidth: number, areaHeight: number, scale: number): TileGrid {
  const tileWidth = TILE.width * scale
  const tileHeight = TILE.height * scale
  const gap = TILE.gap * scale
  const top = -Math.round(tileHeight * TOP_CUT)
  const rows = Math.max(1, Math.ceil((areaHeight - top) / (tileHeight + gap)))
  const height = rows * (tileHeight + gap) - gap
  // The skew (around the grid's centre) shifts the top and bottom rows sideways by up to tan(skew) * height / 2.
  const overscan = Math.tan((TILE.skewDeg * Math.PI) / 180) * (height / 2)
  const cols = Math.max(1, Math.ceil((areaWidth + 2 * overscan + gap) / (tileWidth + gap)))
  const width = cols * (tileWidth + gap) - gap
  return { cols, rows, scale, tileWidth, tileHeight, gap, left: (areaWidth - width) / 2, top, width, height }
}

/** Smallest grid that covers the area after skewing, enlarging the tiles if needed to stay within MAX_TILES. */
export function tileGrid(areaWidth: number, areaHeight: number): TileGrid {
  let scale = 1
  let grid = layout(areaWidth, areaHeight, scale)
  while (grid.cols * grid.rows > MAX_TILES) {
    scale *= Math.max(1.02, Math.sqrt((grid.cols * grid.rows) / MAX_TILES))
    grid = layout(areaWidth, areaHeight, scale)
  }
  return grid
}

/**
 * Index of the tile under a point (area coordinates), undoing the skew; undefined over a gap or outside the grid.
 * Used for the hover highlight, since page content above the tiles takes the pointer events.
 */
export function tileAt(grid: TileGrid, x: number, y: number): number | undefined {
  const gy = y - grid.top
  if (gy < 0 || gy >= grid.height) return undefined
  // skewX(-a) around the centre maps (gx, gy) to (gx - tan(a) * (gy - h/2), gy); invert it.
  const gx = x - grid.left + Math.tan((TILE.skewDeg * Math.PI) / 180) * (gy - grid.height / 2)
  if (gx < 0 || gx >= grid.width) return undefined
  const col = Math.floor(gx / (grid.tileWidth + grid.gap))
  const row = Math.floor(gy / (grid.tileHeight + grid.gap))
  if (gx - col * (grid.tileWidth + grid.gap) > grid.tileWidth) return undefined
  if (gy - row * (grid.tileHeight + grid.gap) > grid.tileHeight) return undefined
  return row * grid.cols + col
}
