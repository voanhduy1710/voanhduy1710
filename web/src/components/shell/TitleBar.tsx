'use client'

import Image from 'next/image'
import {
  LayoutPanelIcon,
  LayoutSecondaryIcon,
  LayoutSidebarIcon,
  MinimizeIcon,
  RestoreIcon,
  WindowCloseIcon,
} from './icons'
import { useSidebar } from './SidebarState'

export type TitleBarLabels = {
  menuBar: readonly string[]
  portfolio: string
  toggleSidebar: string
  togglePanel: string
  toggleSecondarySidebar: string
  minimize: string
  restore: string
  closeWindow: string
}

const layoutIcon = 'flex h-full w-[1.77rem] items-center justify-center text-[#9d9d9d] hover:bg-vsc-hover hover:text-white'
const windowButton = 'flex h-full w-[46px] items-center justify-center text-[#aeaeae] hover:text-white'

/**
 * Windows-style title bar: the VS Code icon (owner-supplied `public/vscode_icon.webp`), decorative menu row, centred `<name> - Portfolio`,
 * layout toggles (the first one shows/hides the sidebar) and decorative window controls.
 */
export function TitleBar({ name, labels }: { name: string; labels: TitleBarLabels }) {
  const { toggle, desktopOpen, mobileOpen } = useSidebar()
  return (
    <header className="grid h-(--ui-titlebar) shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-vsc-border bg-vsc-titlebar font-ui select-none print:hidden">
      <div className="flex min-w-0 items-center gap-[0.1rem] pl-[0.42rem]">
        <Image src="/vscode_icon.webp" alt="" width={20} height={20} unoptimized loading="eager" className="mr-[0.42rem] size-[1.04rem] shrink-0" />
        <span aria-hidden className="flex items-center gap-[0.1rem] max-md:hidden">
          {labels.menuBar.map((item) => (
            <span
              key={item}
              className="rounded-[5px] px-[0.42rem] py-[0.2rem] text-(length:--ui-text) whitespace-nowrap text-vsc-text hover:bg-vsc-hover hover:text-white"
            >
              {item}
            </span>
          ))}
        </span>
      </div>
      <p className="truncate px-2 text-(length:--ui-text-title) text-[#b4b4b4] max-sm:hidden">
        {name} - {labels.portfolio}
      </p>
      <div className="flex h-full items-center justify-end">
        <button
          type="button"
          onClick={toggle}
          title={labels.toggleSidebar}
          aria-label={labels.toggleSidebar}
          aria-controls="explorer"
          aria-pressed={desktopOpen || mobileOpen}
          className={`${layoutIcon} max-md:hidden`}
        >
          <LayoutSidebarIcon className="size-(--ui-icon)" />
        </button>
        <span aria-hidden title={labels.togglePanel} className={`${layoutIcon} max-md:hidden`}>
          <LayoutPanelIcon className="size-(--ui-icon)" />
        </span>
        <span aria-hidden title={labels.toggleSecondarySidebar} className={`${layoutIcon} max-md:hidden`}>
          <LayoutSecondaryIcon className="size-(--ui-icon)" />
        </span>
        <span aria-hidden className="w-[0.52rem] max-md:hidden" />
        <span aria-hidden title={labels.minimize} className={`${windowButton} hover:bg-vsc-hover`}>
          <MinimizeIcon className="size-[10px] shrink-0" />
        </span>
        <span aria-hidden title={labels.restore} className={`${windowButton} hover:bg-vsc-hover`}>
          <RestoreIcon className="size-[10px] shrink-0" />
        </span>
        <span aria-hidden title={labels.closeWindow} className={`${windowButton} hover:bg-[#e81123]`}>
          <WindowCloseIcon className="size-[10px] shrink-0" />
        </span>
      </div>
    </header>
  )
}
