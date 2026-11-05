'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment, useRef, useState, type ReactNode } from 'react'
import type { Lang } from '@/lib/content/types'
import { findNavPage, isFolderOpen, orderRootFiles, type Nav, type NavPage, type NavSection } from '@/lib/nav'
import { ChevronIcon, CloseIcon, FOLDERS, FolderIcon, MoreIcon, PageIcon, type FolderStyle } from './icons'
import { LangSwitch } from './LangSwitch'
import { intentHandlers } from './PreloadScheduler'
import { SectionLink } from './SectionLink'
import { useActiveSection } from './sectionScroll'
import { SidebarResizer } from './SidebarResizer'
import { useSidebar } from './SidebarState'
import { openTabOnClick, useOpenTabs } from './useOpenTabs'

export type ExplorerLabels = {
  title: string
  language: string
  switchToEn: string
  switchToVi: string
  openEditors: string
  outline: string
  timeline: string
  scripts: string
  outlineEmpty: string
  timelineEmpty: string
  scriptsEmpty: string
  closeTab: string
  searchPlaceholder: string
  noResults: string
  folderWorks: string
  folderBi: string
  folderCertifications: string
  resizeExplorer: string
}

/** Left padding of a tree row: 12px + 18px per level (rem at the 120% root). */
const indent = (depth: number) => ({ paddingLeft: `calc(var(--ui-indent) + ${depth} * var(--ui-indent-step))` })

const rowBase =
  'relative mx-[2px] flex h-(--ui-row) w-[calc(100%-4px)] items-center gap-(--ui-row-gap) rounded-[3px] pr-[0.52rem] whitespace-nowrap text-vsc-text hover:bg-vsc-hover'

/** VS Code's list selection: one solid grey row (Dark Modern `list.activeSelectionBackground`), white text. */
const selectedRow = 'bg-vsc-selection text-white hover:bg-vsc-selection'

/** The fixed-width slot that holds a folder's chevron (empty for files, so icons line up). */
function ChevronSlot({ open }: { open?: boolean }) {
  return (
    <span aria-hidden className="flex w-(--ui-icon) shrink-0 items-center justify-center text-vsc-muted">
      {open !== undefined && (
        <ChevronIcon className={`size-(--ui-icon) transition-transform duration-100 motion-reduce:transition-none ${open ? 'rotate-90' : ''}`} />
      )}
    </span>
  )
}

function Folder({
  name,
  folder,
  depth,
  open,
  onToggle,
  dim = false,
}: {
  name: string
  folder: FolderStyle
  depth: number
  open: boolean
  onToggle?: () => void
  dim?: boolean
}) {
  const content = (
    <>
      <Guides depth={depth} />
      <ChevronSlot open={open} />
      <FolderIcon folder={folder} open={open} />
      <span className={`truncate ${dim ? 'text-[#7f859f]' : ''}`}>{name}</span>
    </>
  )
  if (!onToggle) {
    return (
      <div className={rowBase} style={indent(depth)}>
        {content}
      </div>
    )
  }
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className={`${rowBase} text-left`} style={indent(depth)}>
      {content}
    </button>
  )
}

type RowIcon = Parameters<typeof PageIcon>[0]['icon']

/** VS Code's indent guides: one vertical line per enclosing folder below the root. */
function Guides({ depth }: { depth: number }) {
  return Array.from({ length: depth }, (_, k) => (
    <span
      key={k}
      aria-hidden
      className="pointer-events-none absolute inset-y-0 border-l border-[#3a3a3a]"
      style={{ left: `calc(var(--ui-guide) - 2px + ${k} * var(--ui-indent-step))` }}
    />
  ))
}

/** Inside of a file row: the indent guides, the empty chevron slot, the icon, the name and an optional muted hint. */
function RowInner({ icon, label, depth, hint }: { icon: RowIcon; label: string; depth: number; hint?: string }) {
  return (
    <>
      <Guides depth={depth} />
      <ChevronSlot />
      <PageIcon icon={icon} />
      <span className="truncate">{label}</span>
      {hint && <span className="ml-auto shrink-0 pl-[0.42rem] text-(length:--ui-text-sm) text-vsc-muted lowercase">{hint}</span>}
    </>
  )
}

/**
 * A page row (project, config file, the CV, a certificate): navigates, opens and focuses its tab. Its page is
 * prefetched by the background preloader in the owner's order (not by the link itself, which would fetch every
 * visible row at once); hovering, focusing or touching the row fetches it right away.
 */
function PageRow({
  page,
  label = page.label,
  depth,
  selected,
  onPlainClick,
}: {
  page: NavPage
  label?: string
  depth: number
  selected: boolean
  onPlainClick?: () => void
}) {
  const { closeMobile } = useSidebar()
  return (
    <Link
      href={page.href}
      prefetch={false}
      {...intentHandlers(page.href)}
      title={label}
      onClick={openTabOnClick(page.id, () => {
        onPlainClick?.()
        closeMobile()
      })}
      aria-current={selected ? 'page' : undefined}
      className={`${rowBase} ${selected ? selectedRow : ''}`}
      style={indent(depth)}
    >
      <RowInner icon={page.icon} label={label} depth={depth} />
    </Link>
  )
}

/**
 * A row in `public/` that scrolls to a home section. On the home page it scrolls the editor pane without a route
 * navigation; elsewhere it goes home first. Opens the home tab.
 */
function SectionRow({ lang, section, icon, selected }: { lang: Lang; section: NavSection; icon: RowIcon; selected: boolean }) {
  const { closeMobile } = useSidebar()
  return (
    <SectionLink
      lang={lang}
      section={section.id}
      prefetch={false}
      {...intentHandlers(`/${lang}`)}
      onPlainClick={closeMobile}
      title={section.label}
      aria-current={selected ? 'location' : undefined}
      className={`${rowBase} ${selected ? selectedRow : ''}`}
      style={indent(1)}
    >
      <RowInner icon={icon} label={section.label} depth={1} />
    </SectionLink>
  )
}

/** A link out of the site (README.md, a certificate with a link but no PDF): a new browser tab, no editor tab. */
function ExternalRow({ href, label, icon, depth }: { href: string; label: string; icon: RowIcon; depth: number }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={href} className={rowBase} style={indent(depth)}>
      <RowInner icon={icon} label={label} depth={depth} />
    </a>
  )
}

/** A certification without a PDF or a link (not issued yet): plain text, with its README status as a muted hint. */
function TextRow({ label, hint, icon, depth }: { label: string; hint: string; icon: RowIcon; depth: number }) {
  return (
    <div title={`${label} (${hint})`} className={`${rowBase} cursor-default hover:bg-transparent`} style={indent(depth)}>
      <RowInner icon={icon} label={label} depth={depth} hint={hint} />
    </div>
  )
}

/** A collapsible explorer section header (OPEN EDITORS, the root folder, OUTLINE, TIMELINE, SCRIPTS). */
function Panel({
  title,
  defaultOpen,
  grow = false,
  children,
}: {
  title: string
  defaultOpen: boolean
  grow?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`flex flex-col border-t border-vsc-border ${open && grow ? 'min-h-0 flex-1' : 'shrink-0'}`}>
      <h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex h-(--ui-panel-header) w-full items-center gap-[0.2rem] pl-[0.31rem] text-(length:--ui-text-sm) font-bold tracking-[0.04em] text-vsc-text uppercase hover:bg-vsc-hover"
        >
          <ChevronIcon className={`size-(--ui-icon) shrink-0 text-vsc-muted transition-transform duration-100 motion-reduce:transition-none ${open ? 'rotate-90' : ''}`} />
          <span className="truncate">{title}</span>
        </button>
      </h3>
      {open && <div className={grow ? 'min-h-0 flex-1 overflow-y-auto pt-[0.1rem] pb-[0.3rem]' : ''}>{children}</div>}
    </section>
  )
}

function OpenEditors({ nav, closeLabel }: { nav: Nav; closeLabel: string }) {
  const { pages, currentId, close, middleClickClose } = useOpenTabs(nav)
  const { closeMobile } = useSidebar()
  return (
    <ul className="pb-1">
      {pages.map((page) => {
        const active = page.id === currentId
        return (
          <li
            key={page.id}
            {...middleClickClose(page.id)}
            className={`group ${rowBase} pl-[0.6rem] ${active ? selectedRow : ''}`}
          >
            <button
              type="button"
              onClick={() => close(page.id)}
              aria-label={`${closeLabel} ${page.label}`}
              title={closeLabel}
              className={`flex size-[0.94rem] shrink-0 items-center justify-center rounded hover:bg-white/10 ${
                active ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100'
              }`}
            >
              <CloseIcon className="size-[0.52rem]" />
            </button>
            <Link
              href={page.href}
              onClick={openTabOnClick(page.id, closeMobile)}
              className="flex h-full min-w-0 flex-1 items-center gap-(--ui-row-gap)"
            >
              <PageIcon icon={page.icon} />
              <span className="truncate">{page.label}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="px-5 py-1.5 text-(length:--ui-text-sm) text-vsc-muted">{text}</p>
}

/** Explorer tree nodes. A folder whose name matches the filter keeps all its children. */
export type TreeNode =
  | { kind: 'folder'; key: string; name: string; folder: FolderStyle; children: TreeNode[] }
  | { kind: 'section'; key: string; label: string; section: NavSection; icon: RowIcon }
  | { kind: 'page'; key: string; label: string; page: NavPage; first: boolean }
  | { kind: 'link'; key: string; label: string; href: string; icon: RowIcon }
  | { kind: 'text'; key: string; label: string; hint: string; icon: RowIcon }

const matches = (text: string, q: string) => text.toLowerCase().includes(q)

/** Keys of the folders that hold (at any depth) a row of the page `pageId`: they are revealed (opened) by default. */
export function foldersHolding(nodes: TreeNode[], pageId: string | undefined): Set<string> {
  const out = new Set<string>()
  if (pageId === undefined) return out
  const visit = (n: TreeNode): boolean => {
    if (n.kind === 'page') return n.page.id === pageId
    if (n.kind !== 'folder') return false
    const holds = n.children.map(visit).some(Boolean)
    if (holds) out.add(n.key)
    return holds
  }
  nodes.forEach(visit)
  return out
}

/** The nodes left by the filter `q` (empty: everything). */
function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  if (!q) return nodes
  return nodes.flatMap((n): TreeNode[] => {
    if (n.kind !== 'folder') return matches(n.label, q) ? [n] : []
    if (matches(n.name, q)) return [n]
    const children = filterTree(n.children, q)
    return children.length > 0 ? [{ ...n, children }] : []
  })
}

/** `voanhduy1710/`: public/ (home sections), src/ (My works, BI projects, Certifications), then the root files. */
export function treeOf(nav: Nav, labels: ExplorerLabels): TreeNode[] {
  const pageNode = (page: NavPage, key = page.id, label = page.label, first = true): TreeNode => ({ kind: 'page', key, label, page, first })
  const rootFiles = orderRootFiles<TreeNode>(
    pageNode(nav.cv),
    pageNode(nav.readme),
    nav.files.map((f) => ({ name: f.label, item: pageNode(f) })),
  )
  return [
    {
      kind: 'folder',
      key: 'public',
      name: 'public',
      folder: FOLDERS.public,
      children: nav.sections.map((section) => ({
        kind: 'section',
        key: section.id,
        label: section.label,
        section,
        icon: section.id === 'about' ? 'person' : section.icon,
      })),
    },
    {
      kind: 'folder',
      key: 'src',
      name: 'src',
      folder: FOLDERS.src,
      children: [
        { kind: 'folder', key: 'works', name: labels.folderWorks, folder: FOLDERS.works, children: nav.works.map((p) => pageNode(p)) },
        {
          kind: 'folder',
          key: 'bi',
          name: labels.folderBi,
          folder: FOLDERS.bi,
          children: nav.bi.map((row, i) => pageNode(row.page, row.key, row.label, nav.bi.findIndex((r) => r.page.id === row.page.id) === i)),
        },
        {
          kind: 'folder',
          key: 'certifications',
          name: labels.folderCertifications,
          folder: FOLDERS.certifications,
          children: nav.certifications.map((c): TreeNode =>
            c.page
              ? pageNode(c.page)
              : c.href
                ? { kind: 'link', key: `cert-link:${c.no}`, label: c.name, href: c.href, icon: 'certificate' }
                : { kind: 'text', key: `cert-text:${c.no}`, label: c.name, hint: c.status, icon: 'certificate' },
          ),
        },
      ],
    },
    ...rootFiles,
  ]
}

/**
 * The `voanhduy1710` tree. On the home page the row of the section in view is the selected row; on any other page,
 * its page row (when several rows open one page, the row last clicked, else its first one). A collapsed folder that
 * holds the page being shown starts open.
 */
function Tree({ lang, nav, labels }: { lang: Lang; nav: Nav; labels: ExplorerLabels }) {
  const pathname = usePathname()
  const inView = useActiveSection()
  const { view, query } = useSidebar()
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [clicked, setClicked] = useState<{ pageId: string; key: string }>()

  const current = findNavPage(nav, pathname)
  const onHome = current?.id === nav.home.id
  const selectedSection = onHome ? (inView ?? 'about') : undefined
  const q = view === 'search' ? query.trim().toLowerCase() : ''
  const filtering = q !== ''
  const tree = treeOf(nav, labels)
  const nodes = filterTree(tree, q)
  const revealed = foldersHolding(tree, current?.id)

  if (filtering && nodes.length === 0) {
    return <p className="px-5 py-1.5 text-(length:--ui-text-sm) text-vsc-muted">{labels.noResults}</p>
  }

  const isOpen = (key: string) => filtering || isFolderOpen(key, toggled, revealed.has(key))
  const isSelected = (n: Extract<TreeNode, { kind: 'page' }>) =>
    n.page.id === current?.id && (clicked?.pageId === n.page.id ? clicked.key === n.key : n.first)

  const render = (n: TreeNode, depth: number): ReactNode => {
    switch (n.kind) {
      case 'folder':
        return (
          <Fragment key={n.key}>
            <Folder
              name={n.name}
              folder={n.folder}
              depth={depth}
              open={isOpen(n.key)}
              onToggle={() => setToggled((c) => ({ ...c, [n.key]: !isFolderOpen(n.key, c, revealed.has(n.key)) }))}
            />
            {isOpen(n.key) && n.children.map((child) => render(child, depth + 1))}
          </Fragment>
        )
      case 'section':
        return <SectionRow key={n.key} lang={lang} section={n.section} icon={n.icon} selected={n.section.id === selectedSection} />
      case 'page':
        return (
          <PageRow
            key={n.key}
            page={n.page}
            label={n.label}
            depth={depth}
            selected={isSelected(n)}
            onPlainClick={() => setClicked({ pageId: n.page.id, key: n.key })}
          />
        )
      case 'link':
        return <ExternalRow key={n.key} href={n.href} label={n.label} icon={n.icon} depth={depth} />
      case 'text':
        return <TextRow key={n.key} label={n.label} hint={n.hint} icon={n.icon} depth={depth} />
    }
  }

  return (
    <div className="flex flex-col">
      {!filtering && <Folder name=".github" folder={FOLDERS.github} depth={0} open={false} dim />}
      {nodes.map((n) => render(n, 0))}
    </div>
  )
}

function SearchBox({ placeholder }: { placeholder: string }) {
  const { query, setQuery, showView } = useSidebar()
  return (
    <div className="shrink-0 px-[0.62rem] pb-[0.42rem]">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') showView('explorer')
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-[1.35rem] w-full rounded-[3px] border border-[#3c3c3c] bg-[#313131] px-[0.31rem] text-(length:--ui-text) text-vsc-text placeholder:text-[#8b8b8b] focus:border-vsc-accent focus:outline-none"
      />
    </div>
  )
}

/** VS Code-style explorer, with the EN | VI switch in its header. Sidebar on desktop, slide-out panel on mobile. */
export function Explorer({ lang, nav, labels, rootName }: { lang: Lang; nav: Nav; labels: ExplorerLabels; rootName: string }) {
  const { desktopOpen, mobileOpen, closeMobile, view } = useSidebar()
  const asideRef = useRef<HTMLElement>(null)
  return (
    <>
      {mobileOpen && (
        <div aria-hidden onClick={closeMobile} className="absolute inset-0 z-20 bg-black/50 md:hidden print:hidden" />
      )}
      {/* Desktop width: the user's dragged width (`--sidebar-w`, see sidebarWidth.ts) or the default, within 170px .. min(50vw, 560px). */}
      <aside
        ref={asideRef}
        id="explorer"
        aria-label={labels.title}
        className={`absolute inset-y-0 left-(--ui-activity) z-30 w-(--ui-sidebar) max-w-[calc(100vw-var(--ui-activity))] border-r border-vsc-border bg-vsc-sidebar font-ui text-(length:--ui-text) leading-[1.45] text-vsc-text transition-transform duration-200 motion-reduce:transition-none md:relative md:left-auto md:z-auto md:w-[clamp(170px,var(--sidebar-w,var(--ui-sidebar)),min(50vw,560px))] md:translate-x-0 md:transition-none ${
          mobileOpen ? 'translate-x-0' : '-translate-x-[calc(100%+var(--ui-activity))] max-md:invisible'
        } ${desktopOpen ? 'md:flex' : 'md:hidden'} flex shrink-0 flex-col select-none print:hidden`}
      >
        <h2 className="flex h-(--ui-titlebar) shrink-0 items-center justify-between pr-[0.62rem] pl-[1.04rem] text-(length:--ui-text-sm) font-normal tracking-[0.06em] text-[#9d9d9d] uppercase">
          <span className="truncate">{labels.title}</span>
          <span className="flex shrink-0 items-center gap-[0.42rem] tracking-normal normal-case">
            <LangSwitch lang={lang} switchToEn={labels.switchToEn} switchToVi={labels.switchToVi} />
            <MoreIcon aria-hidden className="size-(--ui-icon)" />
          </span>
        </h2>
        {view === 'search' && <SearchBox placeholder={labels.searchPlaceholder} />}
        <div className="flex min-h-0 flex-1 flex-col">
          <Panel title={labels.openEditors} defaultOpen={false}>
            <OpenEditors nav={nav} closeLabel={labels.closeTab} />
          </Panel>
          <Panel title={rootName} defaultOpen grow>
            <Tree lang={lang} nav={nav} labels={labels} />
          </Panel>
          <div className="mt-auto">
            <Panel title={labels.outline} defaultOpen={false}>
              <EmptyPanel text={labels.outlineEmpty} />
            </Panel>
            <Panel title={labels.timeline} defaultOpen={false}>
              <EmptyPanel text={labels.timelineEmpty} />
            </Panel>
            <Panel title={labels.scripts} defaultOpen={false}>
              <EmptyPanel text={labels.scriptsEmpty} />
            </Panel>
          </div>
        </div>
        <SidebarResizer label={labels.resizeExplorer} sidebar={() => asideRef.current} />
      </aside>
    </>
  )
}
