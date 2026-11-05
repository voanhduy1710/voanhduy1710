/**
 * The CV accent colour (headings, rules, links, dates, bullets of `CvDocument`, via the `--cv-accent` CSS variable in
 * `public/cv/cv.css`). Everyone sees `DEFAULT_ACCENT`; only the signed-in owner can pick another one (CvAccentControl),
 * which then also goes into "Print / Save as PDF". The presets are the choices of the owner's CV_colors.html colour sheet, plus
 * a Blues family; every preset has at least 4.5:1 contrast on white (tests/cv/accent.test.ts).
 */

import { isHexColor } from './hex'

export type AccentPreset = { name: string; hex: string }
export type AccentFamily = { family: string; colours: readonly AccentPreset[] }

/** The owner's pick: Pine. Also the default `--cv-accent` in public/cv/cv.css. */
export const DEFAULT_ACCENT = '#1f4d3a'

/** WCAG AA for normal-size text. */
export const MIN_CONTRAST = 4.5

export const ACCENT_FAMILIES: readonly AccentFamily[] = [
  {
    family: 'Neutrals',
    colours: [
      { name: 'Graphite', hex: '#2b2f33' },
      { name: 'Charcoal', hex: '#3a3f44' },
      { name: 'Slate grey', hex: '#4a5560' },
      { name: 'Warm grey', hex: '#5a524a' },
    ],
  },
  {
    family: 'Greens',
    colours: [
      { name: 'Forest', hex: '#2f5d50' },
      { name: 'Pine', hex: '#1f4d3a' },
      { name: 'Olive', hex: '#556b2f' },
      { name: 'Sage', hex: '#4a6b5a' },
    ],
  },
  {
    family: 'Teals',
    colours: [
      { name: 'Deep teal', hex: '#1f5c5c' },
      { name: 'Petrol', hex: '#22505a' },
    ],
  },
  {
    family: 'Blues',
    colours: [
      { name: 'Navy', hex: '#1f3a5f' },
      { name: 'Corporate blue', hex: '#1f5f8b' },
      { name: 'Steel blue', hex: '#2f4f6f' },
      { name: 'Royal', hex: '#27408b' },
    ],
  },
  {
    family: 'Reds / warm',
    colours: [
      { name: 'Burgundy', hex: '#7a2e3a' },
      { name: 'Wine', hex: '#6b2240' },
      { name: 'Brick', hex: '#9a3b2e' },
      { name: 'Rust', hex: '#8a4a1f' },
      { name: 'Terracotta', hex: '#8f4a35' },
    ],
  },
  {
    family: 'Browns / earth',
    colours: [
      { name: 'Espresso', hex: '#4a3328' },
      { name: 'Walnut', hex: '#5c4033' },
      { name: 'Bronze', hex: '#7a5a2a' },
      { name: 'Ochre', hex: '#8a6a12' },
    ],
  },
  {
    family: 'Purples',
    colours: [
      { name: 'Plum', hex: '#5a2a52' },
      { name: 'Aubergine', hex: '#4a2a4a' },
      { name: 'Deep violet', hex: '#4b3a7a' },
    ],
  },
]

export const ACCENT_PRESETS: readonly AccentPreset[] = ACCENT_FAMILIES.flatMap((f) => f.colours)

export { isHexColor }

/** `1f4d3a`, `#1F4D3A`, ` #1f4d3a ` and `#1d3` become `#1f4d3a` / `#11dd33`; anything else is `null`. */
export function normalizeHex(input: string): string | null {
  let v = input.trim().toLowerCase()
  if (!v.startsWith('#')) v = `#${v}`
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return isHexColor(v) ? v : null
}

/** WCAG 2 relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  if (!isHexColor(hex)) throw new Error(`not a #rrggbb colour: ${hex}`)
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** WCAG 2 contrast ratio (1 to 21) of two `#rrggbb` colours; the CV paper is white. */
export function contrastRatio(foreground: string, background = '#ffffff'): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** The preset with this colour, if any (case-insensitive). */
export function presetName(hex: string): string | undefined {
  const v = hex.toLowerCase()
  return ACCENT_PRESETS.find((p) => p.hex === v)?.name
}
