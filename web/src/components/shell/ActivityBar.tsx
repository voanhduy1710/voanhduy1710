'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Lang } from '@/lib/content/types'
import {
  AccountIcon,
  DownloadIcon,
  ExtensionsIcon,
  FilesIcon,
  GitHubMarkIcon,
  LinkedInIcon,
  MailIcon,
  RunDebugIcon,
  SearchIcon,
  SettingsIcon,
  SourceControlIcon,
} from './icons'
import { LangSwitch } from './LangSwitch'
import { SectionLink } from './SectionLink'
import { useActiveSection } from './sectionScroll'
import { useSidebar } from './SidebarState'

export type ActivityLinks = {
  github: string
  linkedin?: { label: string; href: string }
  email?: { label: string; href: string }
  cv: { label: string; href: string }
  projectCount: number
}

export type ActivityLabels = {
  /** The bar's own accessible name. */
  bar: string
  explorer: string
  search: string
  sourceControl: string
  runDebug: string
  extensions: string
  github: string
  accounts: string
  settings: string
  language: string
  switchToEn: string
  switchToVi: string
}

const itemClass =
  'group relative flex h-(--ui-activity) w-(--ui-activity) items-center justify-center text-[#868686] hover:text-white focus-visible:text-white [&>svg]:size-(--ui-activity-icon)'

/** Hover/focus tooltip to the right of an activity-bar item. */
function Tip({ text }: { text: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-[calc(100%+0.2rem)] z-50 rounded-[4px] border border-[#454545] bg-[#252526] px-[0.42rem] py-[0.15rem] font-ui text-[0.625rem] whitespace-nowrap text-[#dddddd] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 max-md:hidden"
    >
      {text}
    </span>
  )
}

/** A small popup menu opened from an activity-bar button (Accounts, Settings). */
function MenuButton({ label, icon, children }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${itemClass} ${open ? 'text-white' : ''}`}
      >
        {icon}
        {!open && <Tip text={label} />}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute bottom-[0.3rem] left-[calc(100%+0.2rem)] z-50 min-w-[10rem] rounded-[6px] border border-[#454545] bg-[#1f1f1f] p-[0.2rem] font-ui text-(length:--ui-text) text-vsc-text shadow-[0_4px_16px_rgb(0_0_0/0.5)]"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

const menuItem =
  'flex w-full items-center gap-[0.42rem] rounded-[4px] px-[0.52rem] py-[0.25rem] whitespace-nowrap hover:bg-vsc-accent hover:text-white [&>svg]:size-(--ui-icon)'

/**
 * Left icon strip. Top: Explorer and Search (sidebar views), Source Control (GitHub profile, badge = project count),
 * Run and Debug (home page's projects section), Extensions (its skills section): both scroll when already on the
 * home page, then a GitHub link (the README's GitHub profile, like Source Control). Bottom: Accounts and Settings menus.
 */
export function ActivityBar({ lang, links, labels }: { lang: Lang; links: ActivityLinks; labels: ActivityLabels }) {
  const { desktopOpen, mobileOpen, view, showView } = useSidebar()
  const inView = useActiveSection()
  const shown = (v: typeof view) => view === v && (mobileOpen || desktopOpen)
  // The sidebar has separate desktop and mobile open states; the mark follows whichever applies.
  const mark = (v: typeof view) =>
    view === v ? (
      <span
        aria-hidden
        className={`absolute inset-y-[0.42rem] left-0 w-0.5 bg-white ${desktopOpen ? 'md:block' : 'md:hidden'} ${mobileOpen ? 'block' : 'hidden'}`}
      />
    ) : null

  return (
    <nav
      aria-label={labels.bar}
      className="relative z-40 flex w-(--ui-activity) shrink-0 flex-col justify-between border-r border-vsc-border bg-vsc-activitybar print:hidden"
    >
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => showView('explorer')}
          aria-label={labels.explorer}
          aria-controls="explorer"
          aria-pressed={shown('explorer')}
          className={`${itemClass} ${view === 'explorer' ? 'text-white' : ''}`}
        >
          {mark('explorer')}
          <FilesIcon />
          <Tip text={labels.explorer} />
        </button>
        <button
          type="button"
          onClick={() => showView('search')}
          aria-label={labels.search}
          aria-controls="explorer"
          aria-pressed={shown('search')}
          className={`${itemClass} ${view === 'search' ? 'text-white' : ''}`}
        >
          {mark('search')}
          <SearchIcon />
          <Tip text={labels.search} />
        </button>
        <a href={links.github} target="_blank" rel="noopener noreferrer" aria-label={labels.sourceControl} className={itemClass}>
          <SourceControlIcon />
          {links.projectCount > 0 && (
            <span
              aria-hidden
              className="absolute right-[0.42rem] bottom-[0.5rem] flex h-[0.83rem] min-w-[0.83rem] items-center justify-center rounded-full bg-vsc-accent px-[0.2rem] text-[0.52rem] leading-none text-white"
            >
              {links.projectCount}
            </span>
          )}
          <Tip text={labels.sourceControl} />
        </a>
        <SectionLink
          lang={lang}
          section="projects"
          aria-label={labels.runDebug}
          aria-current={inView === 'projects' ? 'location' : undefined}
          className={itemClass}
        >
          <RunDebugIcon />
          <Tip text={labels.runDebug} />
        </SectionLink>
        <SectionLink
          lang={lang}
          section="skills"
          aria-label={labels.extensions}
          aria-current={inView === 'skills' ? 'location' : undefined}
          className={itemClass}
        >
          <ExtensionsIcon />
          <Tip text={labels.extensions} />
        </SectionLink>
        <a href={links.github} target="_blank" rel="noopener noreferrer" aria-label={labels.github} className={itemClass}>
          <GitHubMarkIcon />
          <Tip text={labels.github} />
        </a>
      </div>
      <div className="flex flex-col">
        <MenuButton label={labels.accounts} icon={<AccountIcon />}>
          {(close) => (
            <>
              {links.linkedin && (
                <a role="menuitem" href={links.linkedin.href} target="_blank" rel="noopener noreferrer" onClick={close} className={menuItem}>
                  <LinkedInIcon />
                  {links.linkedin.label}
                </a>
              )}
              {links.email && (
                <a role="menuitem" href={links.email.href} onClick={close} className={menuItem}>
                  <MailIcon />
                  {links.email.label}
                </a>
              )}
              <a role="menuitem" href={links.cv.href} download onClick={close} className={menuItem}>
                <DownloadIcon />
                {links.cv.label}
              </a>
            </>
          )}
        </MenuButton>
        <MenuButton label={labels.settings} icon={<SettingsIcon />}>
          {(close) => (
            <div role="none" className="flex items-center justify-between gap-3 px-[0.52rem] py-[0.2rem]">
              <span className="text-(length:--ui-text-sm) text-vsc-muted uppercase">{labels.language}</span>
              <LangSwitch lang={lang} switchToEn={labels.switchToEn} switchToVi={labels.switchToVi} onNavigate={close} />
            </div>
          )}
        </MenuButton>
      </div>
    </nav>
  )
}
