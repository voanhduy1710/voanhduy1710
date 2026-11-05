'use client'

import { useLayoutEffect, useSyncExternalStore } from 'react'
import { applyStoredSidebarWidth, SIDEBAR_WIDTH_BOOT } from './sidebarWidth'

const subscribe = () => () => {}

/**
 * Applies the stored explorer width before the first paint (no jump after hydration).
 *
 * React warns when a client render creates a <script>, which happens on a client navigation that re-renders the root
 * layout (e.g. switching language). So the script is only rendered on the server and during hydration (where it matches
 * the server HTML); every client-only render returns null. `next/script` `beforeInteractive` hits the same warning.
 */
export function SidebarWidthBoot() {
  useLayoutEffect(applyStoredSidebarWidth, [])
  const hydratingOrServer =useSyncExternalStore(subscribe, () => false, () => true)
  if (!hydratingOrServer) return null
  return <script id="sidebar-width-boot" dangerouslySetInnerHTML={{ __html: SIDEBAR_WIDTH_BOOT }} />
}
