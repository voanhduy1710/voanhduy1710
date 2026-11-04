import { describe, expect, it } from 'vitest'
import { parseStored, positionOf, scrollTopFor, serialize } from '@/components/shell/readingPosition'

// EN and VI home pages: same sections, different heights.
const EN = [
  { id: 'about', top: 0, height: 800 },
  { id: 'experience', top: 800, height: 1200 },
  { id: 'skills', top: 2000, height: 600 },
]
const VI = [
  { id: 'about', top: 0, height: 800 },
  { id: 'experience', top: 800, height: 1500 },
  { id: 'skills', top: 2300, height: 700 },
]

describe('positionOf', () => {
  it('names the section at the top of the pane and how far into it the reader is', () => {
    expect(positionOf(0, 2000, EN)).toEqual({ section: 'about', fraction: 0 })
    expect(positionOf(1100, 2000, EN)).toEqual({ section: 'experience', fraction: 0.25 })
    expect(positionOf(2000, 2000, EN)).toEqual({ section: 'skills', fraction: 0 })
  })

  it('without sections (project / file / certificate pages) uses the fraction of the scrollable height', () => {
    expect(positionOf(300, 1200, [])).toEqual({ fraction: 0.25 })
    expect(positionOf(0, 0, [])).toEqual({ fraction: 0 })
    expect(positionOf(5000, 1200, [])).toEqual({ fraction: 1 })
  })
})

describe('scrollTopFor', () => {
  it('lands at the same place in the other language even though the sections are taller', () => {
    const pos = positionOf(1100, 2000, EN) // a quarter into Experience
    expect(scrollTopFor(pos, 2400, VI)).toBe(800 + 0.25 * 1500)
  })

  it('a page fraction maps onto the new scrollable height; it is clamped to the page', () => {
    expect(scrollTopFor({ fraction: 0.5 }, 3000, [])).toBe(1500)
    expect(scrollTopFor({ section: 'skills', fraction: 0.9 }, 2400, VI)).toBe(2400)
    expect(scrollTopFor({ fraction: 7 }, 1000, [])).toBe(1000)
  })

  it('falls back to the page fraction when the section does not exist on the new page', () => {
    expect(scrollTopFor({ section: 'gone', fraction: 0.5 }, 1000, VI)).toBe(500)
  })
})

describe('serialize / parseStored', () => {
  it('round-trips for the target path while fresh', () => {
    const raw = serialize({ section: 'skills', fraction: 0.4 }, '/vi', 1000)
    expect(parseStored(raw, '/vi', 2000)).toEqual({ section: 'skills', fraction: 0.4 })
    expect(parseStored(serialize({ fraction: 0.3 }, '/vi/projects/caro-app', 1000), '/vi/projects/caro-app', 1001)).toEqual({ fraction: 0.3 })
  })

  it('ignores another path, a stale or future entry, and garbage', () => {
    const raw = serialize({ fraction: 0.4 }, '/vi', 1000)
    expect(parseStored(raw, '/en', 1001)).toBeUndefined()
    expect(parseStored(raw, '/vi', 1000 + 16_000)).toBeUndefined()
    expect(parseStored(raw, '/vi', 500)).toBeUndefined()
    expect(parseStored('{nope', '/vi', 1001)).toBeUndefined()
    expect(parseStored(null, '/vi', 1001)).toBeUndefined()
  })
})
