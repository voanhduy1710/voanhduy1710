'use client'

import { usePathname } from 'next/navigation'
import { findNavPage, PROFILE_URL, type Nav } from '@/lib/nav'
import { fileTypeOf } from './fileTypes'
import { BellIcon, BranchIcon, ErrorIcon, GoLiveIcon, RemoteIcon, SyncIcon, WarningIcon } from './icons'

export type StatusBarLabels = { spaces: string; noProblems: string; goLive: string }

const item = 'flex h-full items-center gap-[0.26rem] px-[0.42rem] hover:bg-vsc-hover hover:text-white'
const icon = 'size-[0.73rem] shrink-0'

/**
 * VS Code-style status bar. Left: remote button, branch `main*` (links to the GitHub profile), sync, problems.
 * Right: indentation, encoding, line endings, the current page's language mode, Go Live, bell. Decorative except the branch.
 */
export function StatusBar({ nav, labels }: { nav: Nav; labels: StatusBarLabels }) {
  const page = findNavPage(nav, usePathname())
  const type = page ? fileTypeOf(page.fileName) : undefined
  return (
    <footer className="flex h-(--ui-statusbar) shrink-0 items-center justify-between border-t border-vsc-border bg-vsc-statusbar font-ui text-(length:--ui-text-status) text-[#a8a8a8] select-none print:hidden">
      <div className="flex h-full min-w-0 items-center">
        <span aria-hidden className="flex h-full items-center bg-vsc-accent px-[0.52rem] text-white hover:bg-[#1f8ad2]">
          <RemoteIcon className={icon} />
        </span>
        <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className={item}>
          <BranchIcon className={icon} />
          main*
        </a>
        <span aria-hidden className={`${item} max-sm:hidden`}>
          <SyncIcon className={icon} />
        </span>
        <span title={labels.noProblems} className={`${item} max-sm:hidden`}>
          <span className="sr-only">{labels.noProblems}</span>
          <ErrorIcon className={icon} />
          <span aria-hidden>0</span>
          <WarningIcon className={`${icon} ml-[0.2rem]`} />
          <span aria-hidden>0</span>
        </span>
      </div>
      <div aria-hidden className="flex h-full items-center">
        <span className={`${item} max-lg:hidden`}>{labels.spaces}</span>
        <span className={`${item} max-lg:hidden`}>UTF-8</span>
        <span className={`${item} max-lg:hidden`}>CRLF</span>
        {type && (
          <span className={`${item} max-sm:hidden`}>
            {type.braces && <span>{'{ }'}</span>}
            {type.languageMode}
          </span>
        )}
        <span className={`${item} max-sm:hidden`}>
          <GoLiveIcon className={icon} />
          {labels.goLive}
        </span>
        <span className={`${item} pr-[0.52rem]`}>
          <BellIcon className={icon} />
        </span>
      </div>
    </footer>
  )
}
