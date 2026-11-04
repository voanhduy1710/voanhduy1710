import type { Badge } from '@/lib/content/types'

/** Dark text on light backgrounds, white on dark ones (WCAG relative luminance). */
function textOn(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.4 ? '#1f1f1f' : '#ffffff'
}

/** A shields.io-style two-part chip (label | message) drawn natively: no image request. */
export function BadgeChip({ badge }: { badge: Badge }) {
  const chip = (
    <span className="inline-flex overflow-hidden rounded-sm font-mono text-[0.6875rem] leading-5 whitespace-nowrap">
      {badge.label && <span className="bg-[#555555] px-1.5 text-white">{badge.label}</span>}
      <span className="px-1.5" style={{ backgroundColor: badge.color, color: textOn(badge.color) }}>
        {badge.message}
      </span>
    </span>
  )
  if (!badge.href) return chip
  return (
    <a
      href={badge.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={badge.label ? `${badge.label}: ${badge.message}` : badge.message}
      className="inline-flex hover:opacity-90"
    >
      {chip}
    </a>
  )
}
