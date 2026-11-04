import type { Badge } from '../types'

/** shields.io named colours used in the READMEs, mapped to the hex shields.io renders them as. */
const NAMED_COLORS: Record<string, string> = {
  green: '#97ca00',
  brightgreen: '#44cc11',
  blue: '#007ec6',
  orange: '#fe7d37',
  black: '#000000',
  red: '#e05d44',
  yellow: '#dfb317',
}

const HEX = /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const BADGE_URL = /^https?:\/\/img\.shields\.io\/badge\/([^?#]+)/

/** Splits a static-badge path on single `-`; `--` is a literal dash. */
function splitDashes(path: string): string[] {
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < path.length; i++) {
    if (path[i] !== '-') {
      current += path[i]
    } else if (path[i + 1] === '-') {
      current += '-'
      i++
    } else {
      parts.push(current)
      current = ''
    }
  }
  parts.push(current)
  return parts
}

/** `__` is a literal underscore, `_` a space; then URI-decoded (`%2B` -> `+`). */
function decodePart(part: string): string {
  return decodeURIComponent(part.replace(/__|_/g, (m) => (m === '__' ? '_' : ' ')))
}

function toColor(raw: string): string {
  if (HEX.test(raw)) return `#${raw}`
  const named = NAMED_COLORS[raw.toLowerCase()]
  if (!named) throw new Error(`unknown badge colour: ${raw} (known: ${Object.keys(NAMED_COLORS).join(', ')} or hex)`)
  return named
}

/**
 * Reads a static shields.io badge URL (`/badge/<label>-<message>-<color>.svg`) into a native chip.
 * Throws a plain Error; callers add the file context.
 */
export function parseShieldsBadge(url: string, alt: string, href?: string): Badge {
  const m = url.match(BADGE_URL)
  if (!m) throw new Error(`not a shields.io badge URL: ${url}`)
  const parts = splitDashes(m[1].replace(/\.svg$/i, ''))
  if (parts.length < 2) throw new Error(`badge URL needs <message>-<color>: ${url}`)
  let decoded: string[]
  try {
    decoded = parts.map(decodePart)
  } catch {
    throw new Error(`malformed URI in badge URL: ${url}`)
  }
  const color = toColor(decoded[decoded.length - 1].trim())
  const message = decoded[decoded.length - 2].trim()
  const label = decoded.slice(0, -2).join('-').trim() || alt.trim()
  const badge: Badge = { label, message, color }
  if (href) badge.href = href
  if (alt.trim()) badge.alt = alt.trim()
  return badge
}
