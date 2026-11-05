import { describe, expect, it } from 'vitest'
import {
  ACCENT_FAMILIES,
  ACCENT_PRESETS,
  contrastRatio,
  DEFAULT_ACCENT,
  isHexColor,
  MIN_CONTRAST,
  normalizeHex,
  presetName,
  relativeLuminance,
} from '@/lib/cv/accent'

describe('hex colour validation', () => {
  it('accepts #rrggbb only (the cv_preferences check constraint)', () => {
    for (const ok of ['#1f4d3a', '#1F4D3A', '#000000', '#ffffff']) expect(isHexColor(ok)).toBe(true)
    for (const bad of ['1f4d3a', '#1f4d3', '#1f4d3a0', '#ggg000', 'red', '', ' #1f4d3a', null, 42]) expect(isHexColor(bad)).toBe(false)
  })
  it('normalizes user input', () => {
    expect(normalizeHex('1F4D3A')).toBe('#1f4d3a')
    expect(normalizeHex('  #1f4d3a ')).toBe('#1f4d3a')
    expect(normalizeHex('#1d3')).toBe('#11dd33')
    expect(normalizeHex('#12345')).toBeNull()
    expect(normalizeHex('blue')).toBeNull()
  })
})

describe('contrast (WCAG 2)', () => {
  it('matches known values', () => {
    expect(contrastRatio('#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#777777')).toBeCloseTo(4.48, 2)
    expect(contrastRatio('#767676')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
  })
  it('throws on a non-hex colour', () => {
    expect(() => relativeLuminance('red')).toThrow()
  })
})

describe('accent presets', () => {
  it('has the 22 colours of CV_colors.html plus a Blues family', () => {
    // The colour sheet the owner picked from (CV_colors.html, 6 families).
    const fromMockup = [
      '#2b2f33', '#3a3f44', '#4a5560', '#5a524a', '#2f5d50', '#1f4d3a', '#556b2f', '#4a6b5a', '#1f5c5c', '#22505a', '#7a2e3a',
      '#6b2240', '#9a3b2e', '#8a4a1f', '#8f4a35', '#4a3328', '#5c4033', '#7a5a2a', '#8a6a12', '#5a2a52', '#4a2a4a', '#4b3a7a',
    ]
    const hexes = ACCENT_PRESETS.map((p) => p.hex)
    for (const hex of fromMockup) expect(hexes).toContain(hex)
    const blues = ACCENT_FAMILIES.find((f) => f.family === 'Blues')
    expect(blues?.colours.map((c) => c.hex)).toEqual(['#1f3a5f', '#1f5f8b', '#2f4f6f', '#27408b'])
    expect(ACCENT_PRESETS).toHaveLength(26)
    expect(new Set(hexes).size).toBe(hexes.length)
  })
  it('every preset is lower-case #rrggbb with at least 4.5:1 contrast on white', () => {
    for (const p of ACCENT_PRESETS) {
      expect(p.hex).toMatch(/^#[0-9a-f]{6}$/)
      expect(contrastRatio(p.hex), p.name).toBeGreaterThanOrEqual(MIN_CONTRAST)
    }
  })
  it('the default is Pine', () => {
    expect(DEFAULT_ACCENT).toBe('#1f4d3a')
    expect(presetName(DEFAULT_ACCENT)).toBe('Pine')
    expect(presetName('#7A2E3A')).toBe('Burgundy')
    expect(presetName('#123456')).toBeUndefined()
  })
})
