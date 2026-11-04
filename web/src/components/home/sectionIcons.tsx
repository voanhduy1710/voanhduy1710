import type { SVGProps } from 'react'
import type { HomeSectionId } from '@/lib/sections'

/** Heading icons of the home sections, drawn for this site (24-unit grid, stroked like the shell icons). */
type IconProps = SVGProps<SVGSVGElement>

const base = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function BriefcaseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M3 12.5h18M10.5 12.5v1.5h3v-1.5" />
    </svg>
  )
}

export function OpenBookIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 6.5C10.2 5 7.6 4.5 3.5 4.5v13c4.1 0 6.7.5 8.5 2 1.8-1.5 4.4-2 8.5-2v-13c-4.1 0-6.7.5-8.5 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  )
}

export function ArchiveBoxIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="4" width="19" height="4.5" rx="1" />
      <path d="M4 8.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8.5" />
      <path d="M9.5 12.5h5" />
    </svg>
  )
}

export function EnvelopeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  )
}

/** Each titled section's icon and glow colour; the hero (`about`) has none. */
export const SECTION_ICONS: Partial<Record<HomeSectionId, { Icon: (p: IconProps) => React.JSX.Element; glow: string; name: string }>> = {
  experience: { Icon: BriefcaseIcon, glow: '#f97316', name: 'briefcase' },
  skills: { Icon: OpenBookIcon, glow: '#a855f7', name: 'book' },
  projects: { Icon: ArchiveBoxIcon, glow: '#eab308', name: 'archive' },
  contact: { Icon: EnvelopeIcon, glow: '#60a5fa', name: 'envelope' },
}
