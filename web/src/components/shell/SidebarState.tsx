'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

const MOBILE_QUERY = '(max-width: 767px)'

export type SidebarView = 'explorer' | 'search'

type SidebarState = {
  /** Desktop: sidebar shown (default). */
  desktopOpen: boolean
  /** Mobile: slide-out panel shown (default hidden). */
  mobileOpen: boolean
  /** Explorer alone, or the explorer with its name filter box (Search). */
  view: SidebarView
  query: string
  setQuery: (query: string) => void
  /** Activity-bar behaviour: show `view`; clicking the view that is already showing hides the sidebar. */
  showView: (view: SidebarView) => void
  /** Title-bar "Toggle Primary Side Bar": show/hide, keeping the view. */
  toggle: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarState | null>(null)

export function useSidebar(): SidebarState {
  const state = useContext(SidebarContext)
  if (!state) throw new Error('useSidebar must be used inside <SidebarProvider>')
  return state
}

/** Holds the sidebar's open/closed state, view and filter text, shared by the title bar, activity bar and explorer. */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [desktopOpen, setDesktopOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [view, setView] = useState<SidebarView>('explorer')
  const [query, setQuery] = useState('')

  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches

  const showView = (next: SidebarView) => {
    const mobile = isMobile()
    const open = mobile ? mobileOpen : desktopOpen
    const setOpen = mobile ? setMobileOpen : setDesktopOpen
    if (open && view === next) {
      setOpen(false)
    } else {
      setView(next)
      setOpen(true)
    }
    if (next === 'explorer') setQuery('')
  }

  const toggle = () => (isMobile() ? setMobileOpen((o) => !o) : setDesktopOpen((o) => !o))
  const closeMobile = () => setMobileOpen(false)

  return (
    <SidebarContext.Provider
      value={{ desktopOpen, mobileOpen, view, query, setQuery, showView, toggle, closeMobile }}
    >
      {children}
    </SidebarContext.Provider>
  )
}
