import { useId, type ReactNode, type SVGProps } from 'react'
import type { NavIcon } from '@/lib/nav'

/**
 * Inline SVG icons for the shell (no icon font, no third-party images).
 * LinkedIn and Mail icon paths adapted from Lucide (ISC License; Feather-derived parts MIT), https://lucide.dev.
 * The GitHub mark follows the Octicons `mark-github` silhouette (MIT, © GitHub Inc.), https://github.com/primer/octicons;
 * the GitHub logo is a trademark of GitHub, used only to link to GitHub. See THIRD_PARTY_NOTICES.md.
 * The title-bar VS Code icon is an image supplied by the site owner (public/vscode_icon.webp).
 * All other icons (activity bar, file types, folders, status bar, editor actions) are drawn for this site.
 */
type IconProps = SVGProps<SVGSVGElement>

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** 16-unit grid like VS Code's codicons; sized by CSS. */
const small = { ...base, width: 16, height: 16, viewBox: '0 0 16 16', strokeWidth: 1.2 }

/* ---------------------------------------------------------------------------------------------
 * Title bar
 * ------------------------------------------------------------------------------------------- */

export function LayoutSidebarIcon(props: IconProps) {
  return (
    <svg {...small} {...props}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <rect x="2" y="3" width="4" height="10" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function LayoutPanelIcon(props: IconProps) {
  return (
    <svg {...small} {...props}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M1.5 9.5h13" />
    </svg>
  )
}

export function LayoutSecondaryIcon(props: IconProps) {
  return (
    <svg {...small} {...props}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M10 2.5v11" />
    </svg>
  )
}

/*
 * Window buttons: drawn on a 10x10 pixel grid like Windows' caption glyphs. 1px strokes sit on half-pixel
 * coordinates and `crispEdges` keeps them one device pixel wide, so render them at exactly 10x10 CSS px.
 */
const windowGlyph = {
  width: 10,
  height: 10,
  viewBox: '0 0 10 10',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1,
  'aria-hidden': true,
} as const

export function MinimizeIcon(props: IconProps) {
  return (
    <svg {...windowGlyph} shapeRendering="crispEdges" {...props}>
      <path d="M0 5.5h10" />
    </svg>
  )
}

/**
 * Two overlapping squares: the back one up-right, the front one lower-left. The front square hides the back
 * square's lines behind it (a mask, so it works on any button background, hovered or not).
 */
export function RestoreIcon(props: IconProps) {
  const mask = `restore-mask-${useId().replace(/:/g, '')}`
  return (
    <svg {...windowGlyph} shapeRendering="crispEdges" {...props}>
      <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="10" height="10">
        <rect width="10" height="10" fill="white" stroke="none" />
        <rect x="0" y="2" width="8" height="8" fill="black" stroke="none" />
      </mask>
      <rect x="2.5" y="0.5" width="7" height="7" mask={`url(#${mask})`} />
      <rect x="0.5" y="2.5" width="7" height="7" />
    </svg>
  )
}

export function WindowCloseIcon(props: IconProps) {
  return (
    <svg {...windowGlyph} {...props}>
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
    </svg>
  )
}

/* ---------------------------------------------------------------------------------------------
 * Activity bar
 * ------------------------------------------------------------------------------------------- */

export function FilesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v12" />
      <path d="M9 7h7l4 4v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2z" />
      <path d="M16 7v4h4" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="14" cy="10" r="6" />
      <path d="M9.7 14.3 4 20" />
    </svg>
  )
}

export function SourceControlIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="8" r="2" />
      <path d="M6 7v10M18 10c0 5-8 3-11 7" />
    </svg>
  )
}

export function RunDebugIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 5l11 7-11 7z" />
      <circle cx="6" cy="17" r="3.2" fill="var(--vsc-activitybar)" />
      <path d="M6 15v4M4.3 16.2h3.4" />
    </svg>
  )
}

export function ExtensionsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="10" width="6" height="6" />
      <rect x="9" y="10" width="6" height="6" />
      <rect x="3" y="15" width="6" height="5" />
      <rect x="14" y="3" width="6" height="6" transform="rotate(12 17 6)" />
    </svg>
  )
}

export function AccountIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M6 18.5c1.6-2.5 3.6-3.5 6-3.5s4.4 1 6 3.5" />
    </svg>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </svg>
  )
}

/** The GitHub mark, filled (hero button). Octicons `mark-github` silhouette, MIT © GitHub Inc. – see THIRD_PARTY_NOTICES.md. */
export function GitHubMarkIcon(props: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  )
}

export function LinkedInIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M7.5 10.5V17M7.5 7.25v.01M11.5 17v-6.5M11.5 13.25a2.75 2.75 0 0 1 5.5 0V17" />
    </svg>
  )
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
    </svg>
  )
}

/* ---------------------------------------------------------------------------------------------
 * Explorer, tabs, editor actions
 * ------------------------------------------------------------------------------------------- */

export function ChevronIcon(props: IconProps) {
  return (
    <svg {...small} strokeWidth={1.4} {...props}>
      <path d="m6 4 4 4-4 4" />
    </svg>
  )
}

export function DoubleChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.6} {...props}>
      <path d="M6 6l6 6 6-6M6 12l6 6 6-6" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...props}>
      <path d="M1 1l8 8M9 1L1 9" />
    </svg>
  )
}

export function OpenChangesIcon(props: IconProps) {
  return (
    <svg {...small} {...props}>
      <circle cx="4" cy="4" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <path d="M4 6v4a2 2 0 0 0 2 2h4M12 10V6a2 2 0 0 0-2-2H6" />
    </svg>
  )
}

export function SplitEditorIcon(props: IconProps) {
  return (
    <svg {...small} {...props}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M8 2.5v11" />
    </svg>
  )
}

export function MoreIcon(props: IconProps) {
  return (
    <svg {...small} fill="currentColor" stroke="none" {...props}>
      <circle cx="3.5" cy="8" r="1.1" />
      <circle cx="8" cy="8" r="1.1" />
      <circle cx="12.5" cy="8" r="1.1" />
    </svg>
  )
}

/* ---------------------------------------------------------------------------------------------
 * Status bar
 * ------------------------------------------------------------------------------------------- */

export function RemoteIcon(props: IconProps) {
  return (
    <svg {...small} strokeWidth={1.5} {...props}>
      <path d="M5 4 1.5 7.5 5 11M11 5l3.5 3.5L11 12" />
    </svg>
  )
}

export function BranchIcon(props: IconProps) {
  return (
    <svg {...small} strokeWidth={1.3} {...props}>
      <circle cx="4.5" cy="3.5" r="1.6" />
      <circle cx="4.5" cy="12.5" r="1.6" />
      <circle cx="11.5" cy="5.5" r="1.6" />
      <path d="M4.5 5v6M11.5 7c0 3-5 2-7 4" />
    </svg>
  )
}

export function SyncIcon(props: IconProps) {
  return (
    <svg {...small} strokeWidth={1.3} {...props}>
      <path d="M13 7a5 5 0 0 0-9-2.5M3 9a5 5 0 0 0 9 2.5" />
      <path d="M4 2v3h3M12 14v-3H9" />
    </svg>
  )
}

export function ErrorIcon(props: IconProps) {
  return (
    <svg {...small} {...props}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="m5.75 5.75 4.5 4.5M10.25 5.75l-4.5 4.5" />
    </svg>
  )
}

export function WarningIcon(props: IconProps) {
  return (
    <svg {...small} {...props}>
      <path d="M8 2.25 14.25 13.5H1.75L8 2.25Z" />
      <path d="M8 6.5v3.25M8 11.6v.01" />
    </svg>
  )
}

export function GoLiveIcon(props: IconProps) {
  return (
    <svg {...small} strokeWidth={1.3} {...props}>
      <circle cx="8" cy="8" r="1.6" />
      <path d="M4.8 11.2a4.5 4.5 0 0 1 0-6.4M11.2 4.8a4.5 4.5 0 0 1 0 6.4M2.6 13.4a7.6 7.6 0 0 1 0-10.8M13.4 2.6a7.6 7.6 0 0 1 0 10.8" />
    </svg>
  )
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...small} strokeWidth={1.3} {...props}>
      <path d="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11z" />
      <path d="M6.5 14h3" />
    </svg>
  )
}

/* ---------------------------------------------------------------------------------------------
 * Coloured file icons, in the spirit of a VS Code icon theme (drawn for this site, after the mockup).
 * ------------------------------------------------------------------------------------------- */

const glyphs: Record<NavIcon | 'person' | 'markdown' | 'certificate', ReactNode> = {
  star: <path d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.3l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="#f5c542" />,
  person: (
    <>
      <circle cx="6" cy="5" r="2.4" fill="#8bd17c" />
      <path d="M2 13c.6-2.6 2.2-4 4-4s3.4 1.4 4 4" fill="#8bd17c" />
      <path d="M10 9l2 2 3-4" stroke="#f5c542" strokeWidth={1.4} fill="none" />
    </>
  ),
  experience: (
    <>
      <rect x="2" y="3" width="12" height="8" rx="1" fill="none" stroke="#4fb6ff" strokeWidth={1.3} />
      <path d="M1 13h14" stroke="#4fb6ff" strokeWidth={1.3} />
    </>
  ),
  skills: (
    <>
      <path d="M4 2H2v12h2M12 2h2v12h-2" stroke="#ef6b5b" strokeWidth={1.3} fill="none" />
      <text x="8" y="10.5" fontSize="6" textAnchor="middle" fill="#ef6b5b" fontFamily="Consolas, monospace">
        01
      </text>
    </>
  ),
  projects: (
    <>
      <path d="M8 1.5a4.5 4.5 0 0 0-2.5 8.2V12h5V9.7A4.5 4.5 0 0 0 8 1.5z" fill="none" stroke="#f5c542" strokeWidth={1.3} />
      <path d="M6 14h4" stroke="#f5c542" strokeWidth={1.3} />
    </>
  ),
  contact: (
    <>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1" fill="#4fb6ff" />
      <path d="M1.5 4l6.5 5 6.5-5" stroke="#181818" strokeWidth={1.2} fill="none" />
    </>
  ),
  pdf: (
    <>
      <path d="M3.5 1.5h6l3 3v10h-9z" fill="#e5484d" />
      <text x="8" y="12" fontSize="4.6" textAnchor="middle" fill="#fff" fontFamily="Segoe UI, sans-serif" fontWeight={700}>
        PDF
      </text>
    </>
  ),
  markdown: (
    <>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" fill="none" stroke="#4fb6ff" />
      <text x="8" y="10.8" fontSize="6.2" textAnchor="middle" fill="#4fb6ff" fontFamily="Consolas, monospace" fontWeight={700}>
        M↓
      </text>
    </>
  ),
  react: (
    <g fill="none" stroke="#61dafb" strokeWidth={1}>
      <ellipse cx="8" cy="8" rx="6.5" ry="2.6" />
      <ellipse cx="8" cy="8" rx="6.5" ry="2.6" transform="rotate(60 8 8)" />
      <ellipse cx="8" cy="8" rx="6.5" ry="2.6" transform="rotate(120 8 8)" />
      <circle cx="8" cy="8" r="1.2" fill="#61dafb" stroke="none" />
    </g>
  ),
  nestjs: (
    <>
      <circle cx="8" cy="8" r="6.5" fill="#e0234e" />
      <text x="8" y="11" fontSize="8" textAnchor="middle" fill="#fff" fontFamily="Segoe UI, sans-serif" fontWeight={700}>
        N
      </text>
    </>
  ),
  typescript: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="2" fill="#3178c6" />
      <text x="8" y="12" fontSize="7" textAnchor="middle" fill="#fff" fontFamily="Segoe UI, sans-serif" fontWeight={700}>
        TS
      </text>
    </>
  ),
  fastapi: (
    <>
      <circle cx="8" cy="8" r="6.5" fill="#009688" />
      <path d="M8.6 3.5L5 9h3l-.6 3.5L11 7H8z" fill="#fff" />
    </>
  ),
  python: (
    <>
      <path d="M8 1.5c3 0 3 1.5 3 3v2H5.5c-2 0-3 1-3 3s1 3 3 3H6" fill="none" stroke="#3b82f6" strokeWidth={1.6} />
      <path d="M8 14.5c-3 0-3-1.5-3-3v-2h5.5c2 0 3-1 3-3s-1-3-3-3H10" fill="none" stroke="#f5c542" strokeWidth={1.6} />
    </>
  ),
  powerbi: (
    <>
      <rect x="2" y="8" width="3" height="6" fill="#f2c811" />
      <rect x="6.5" y="5" width="3" height="9" fill="#f2c811" />
      <rect x="11" y="2" width="3" height="12" fill="#f2c811" />
    </>
  ),
  file: <path d="M3.5 1.5h6l3 3v10h-9z M9.5 1.5v3h3" fill="none" stroke="#9aa0b8" strokeWidth={1.1} />,
  // Config files of the root folder.
  git: (
    <>
      <rect x="3" y="3" width="10" height="10" rx="1.6" transform="rotate(45 8 8)" fill="#f05133" />
      <path d="M6.2 5.4 9.6 8.8M8 7.2v3.6" stroke="#fff" strokeWidth={1.1} fill="none" />
      <circle cx="8" cy="11" r="1" fill="#fff" />
      <circle cx="9.8" cy="9" r="1" fill="#fff" />
    </>
  ),
  vercel: <path d="M8 2.5 14.5 13.5h-13z" fill="#ededed" />,
  nextjs: (
    <>
      <circle cx="8" cy="8" r="6.3" fill="#000" stroke="#ededed" strokeWidth={0.9} />
      <path d="M5.8 11V5l4.8 6.6M10.2 5v3.8" stroke="#ededed" strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </>
  ),
  npm: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="1" fill="#cb3837" />
      <path d="M4.6 11.4V4.6h6.8v6.8H9.2V6.8H6.8v4.6z" fill="#fff" />
    </>
  ),
  tsconfig: (
    <>
      <path d="M5 2.5H4a1.5 1.5 0 0 0-1.5 1.5v2.5L1.5 8l1 1.5V12A1.5 1.5 0 0 0 4 13.5h1M11 2.5h1A1.5 1.5 0 0 1 13.5 4v2.5l1 1.5-1 1.5V12a1.5 1.5 0 0 1-1.5 1.5h-1" fill="none" stroke="#3178c6" strokeWidth={1.2} />
      <text x="8" y="10.4" fontSize="5.6" textAnchor="middle" fill="#3178c6" fontFamily="Segoe UI, sans-serif" fontWeight={700}>
        TS
      </text>
    </>
  ),
  certificate: (
    <>
      <path d="M5.6 8.6 4.4 14l1.9-.9 1.2 1.6.5-5.2M10.4 8.6l1.2 5.4-1.9-.9-1.2 1.6-.5-5.2" fill="#e5484d" />
      <circle cx="8" cy="6.2" r="4.4" fill="#f5c542" />
      <circle cx="8" cy="6.2" r="2.6" fill="none" stroke="#b7791f" strokeWidth={0.9} />
    </>
  ),
}

const iconBox = 'size-(--ui-icon) shrink-0'

/** Coloured 16×16 file icon (page icons, plus `person` for the About Me row, `markdown` for README.md, `certificate`). */
export function PageIcon({ icon, className = '' }: { icon: keyof typeof glyphs; className?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden className={`${iconBox} ${className}`}>
      {glyphs[icon]}
    </svg>
  )
}

/** The small glyph in a folder's corner badge, in the spirit of Material Icon Theme's named folders (drawn for this site). */
export type FolderBadge = 'globe' | 'code' | 'works' | 'chart' | 'certificate'

/** Folder colour and the darker tone of its badge. */
export type FolderStyle = { color: string; badge?: FolderBadge; badgeColor?: string }

/** Explorer folders: `public/` blue with a globe, `src/` green with `<>`, and a distinct colour per `src/` sub-folder. */
export const FOLDERS = {
  github: { color: '#7d8fbf' },
  public: { color: '#4fb6ff', badge: 'globe', badgeColor: '#1565c0' },
  src: { color: '#8bd17c', badge: 'code', badgeColor: '#2e7d32' },
  works: { color: '#ef6b5b', badge: 'works', badgeColor: '#b3261e' },
  bi: { color: '#f2c811', badge: 'chart', badgeColor: '#a66f00' },
  certifications: { color: '#b18cf2', badge: 'certificate', badgeColor: '#6a3fc1' },
} as const satisfies Record<string, FolderStyle>

const badgeGlyphs: Record<FolderBadge, ReactNode> = {
  globe: (
    <g fill="none" stroke="#fff" strokeWidth={0.75}>
      <circle cx="12" cy="11.6" r="2.4" />
      <ellipse cx="12" cy="11.6" rx="1" ry="2.4" />
      <path d="M9.6 11.6h4.8" />
    </g>
  ),
  code: <path d="M11 10.1 9.6 11.6l1.4 1.5M13 10.1l1.4 1.5-1.4 1.5" fill="none" stroke="#fff" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" />,
  works: (
    <g fill="none" stroke="#fff" strokeWidth={0.8}>
      <rect x="9.7" y="10.6" width="4.6" height="3" rx="0.5" />
      <path d="M11.2 10.6v-.8h1.6v.8" />
    </g>
  ),
  chart: (
    <g fill="#fff">
      <rect x="9.9" y="11.8" width="1" height="1.9" />
      <rect x="11.5" y="10.6" width="1" height="3.1" />
      <rect x="13.1" y="9.5" width="1" height="4.2" />
    </g>
  ),
  certificate: (
    <g fill="#fff">
      <circle cx="12" cy="10.9" r="1.5" />
      <path d="M11.1 12.1l-.6 1.9.9-.4.6.7.3-1.9M12.9 12.1l.6 1.9-.9-.4-.6.7-.3-1.9" />
    </g>
  ),
}

/** A folder, closed or open, with an optional corner badge. */
export function FolderIcon({ folder, open, className = '' }: { folder: FolderStyle; open: boolean; className?: string }) {
  const { color, badge, badgeColor } = folder
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden className={`${iconBox} ${className}`}>
      {open ? (
        <>
          <path d="M1 3a.5.5 0 0 1 .5-.5h4l1.5 1.5h6a1 1 0 0 1 1 1V6H3.6L1 11.6z" fill={color} opacity={0.75} />
          <path d="M3.5 6.6h11.4a.4.4 0 0 1 .37.55L13 12.4H1.4z" fill={color} />
        </>
      ) : (
        <path d="M1 3a.5.5 0 0 1 .5-.5h4l1.5 1.5h6a1 1 0 0 1 1 1v6.4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z" fill={color} />
      )}
      {badge && (
        <>
          <circle cx="12" cy="11.6" r="3.9" fill={badgeColor} />
          {badgeGlyphs[badge]}
        </>
      )}
    </svg>
  )
}
