'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import type { Nav } from '@/lib/nav'
import { CloseIcon, MoreIcon, OpenChangesIcon, PageIcon, SplitEditorIcon } from './icons'
import { useOpenTabs } from './useOpenTabs'

const action = 'flex size-[1.35rem] items-center justify-center rounded-[5px] hover:bg-vsc-hover'

export type TabsLabels = { openEditors: string; closeTab: string; openChanges: string; splitEditor: string; moreActions: string }

/**
 * Editor tabs: navigating to a page opens its tab (once) and the active tab follows the URL.
 * × or a middle-click closes a tab.
 */
export function Tabs({ nav, labels }: { nav: Nav; labels: TabsLabels }) {
  const { pages, currentId, close, middleClickClose } = useOpenTabs(nav)
  const stripRef = useRef<HTMLElement>(null)

  // Keep the active tab visible when it is off the end of a long tab strip.
  useEffect(() => {
    if (!currentId) return
    const tab = stripRef.current?.querySelector(`[data-tab="${CSS.escape(currentId)}"]`)
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [currentId, pages.length])

  return (
    <div className="relative z-10 flex h-(--ui-tab) shrink-0 border-b border-vsc-border bg-vsc-tab-inactive font-ui select-none print:hidden">
      <nav ref={stripRef} aria-label={labels.openEditors} className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
        {pages.map((page) => {
          const active = page.id === currentId
          return (
            <div
              key={page.id}
              data-tab={page.id}
              {...middleClickClose(page.id)}
              className={`group relative flex shrink-0 items-center border-r border-vsc-border text-(length:--ui-text) ${
                active ? 'bg-vsc-tab-active text-white' : 'text-[#8d8d8d] hover:text-vsc-text'
              }`}
            >
              {active && <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-vsc-accent" />}
              <Link
                href={page.href}
                aria-current={active ? 'page' : undefined}
                className="flex h-full items-center gap-[0.42rem] pr-[0.2rem] pl-[0.73rem] whitespace-nowrap"
              >
                <PageIcon icon={page.icon} />
                {page.label}
              </Link>
              <button
                type="button"
                onClick={() => close(page.id)}
                aria-label={`${labels.closeTab} ${page.label}`}
                title={labels.closeTab}
                className={`mr-[0.42rem] flex size-[0.94rem] items-center justify-center rounded hover:bg-vsc-hover ${
                  active ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100'
                }`}
              >
                <CloseIcon className="size-[0.52rem]" />
              </button>
            </div>
          )
        })}
      </nav>
      {/* Decorative editor actions, as in VS Code's tab strip. */}
      <div aria-hidden className="hidden shrink-0 items-center gap-[0.2rem] pr-[0.42rem] pl-[0.2rem] text-[#9d9d9d] sm:flex">
        <span title={labels.openChanges} className={action}>
          <OpenChangesIcon className="size-(--ui-icon)" />
        </span>
        <span title={labels.splitEditor} className={action}>
          <SplitEditorIcon className="size-(--ui-icon)" />
        </span>
        <span title={labels.moreActions} className={action}>
          <MoreIcon className="size-(--ui-icon)" />
        </span>
      </div>
    </div>
  )
}
