'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { findNavPage, navPages, type Nav } from '@/lib/nav'
import { isPlainClick, middleClickClose as middleClickHandlers, type MouseLike } from './mouse'
import { addTab, closeTab, parseTabIds } from './tabList'

/** Open tabs are stored as language-neutral page ids, so they survive the EN/VI switch. */
const STORAGE_KEY = 'vsc-tabs'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const readStored = () => sessionStorage.getItem(STORAGE_KEY) ?? '[]'
/** `null` = storage not readable yet (server render and hydration): only the current page's tab is shown. */
const readServer = () => null

function writeStored(ids: string[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  for (const l of listeners) l()
}

/**
 * The open editors, shared (through sessionStorage) by the tab strip and the explorer's OPEN EDITORS panel.
 * A page's tab opens when it is navigated to (and right away on an explorer/activity click, via `openTab`);
 * closing the current tab moves to its neighbour. Used by leaf components only: it reads the pathname, and a
 * provider reading it above the page would make the not-found catch-all route fail to prerender.
 */
export function useOpenTabs(nav: Nav) {
  const pathname = usePathname()
  const router = useRouter()
  const raw = useSyncExternalStore<string | null>(subscribe, readStored, readServer)
  const byId = useMemo(() => new Map(navPages(nav).map((f) => [f.id, f])), [nav])
  const currentId = findNavPage(nav, pathname)?.id

  const pages = useMemo(() => {
    const ids = raw === null ? (currentId ? [currentId] : []) : parseTabIds(raw).filter((id) => byId.has(id))
    return ids.map((id) => byId.get(id)!)
  }, [raw, byId, currentId])

  // Idempotent, so it is safe that both the tab strip and the explorer run it.
  useEffect(() => {
    if (currentId) openTab(currentId)
  }, [currentId])

  const close = useCallback(
    (id: string) => {
      const { ids, next } = closeTab(parseTabIds(readStored()).filter((x) => byId.has(x)), id, currentId)
      writeStored(ids)
      if (next) router.push(byId.get(next)!.href)
    },
    [byId, currentId, router],
  )

  /** Handlers for a tab-like element: middle-click closes it without autoscroll or a new browser tab. */
  const middleClickClose = useCallback((id: string) => middleClickHandlers(() => close(id)), [close])

  return { pages, currentId, close, middleClickClose }
}

/** Opens a page's tab (no-op if open). Called on explorer/activity clicks, before the navigation finishes. */
export function openTab(id: string) {
  writeIfChanged(addTab(parseTabIds(readStored()), id))
}

/**
 * onClick for a link to a page: opens its tab on a plain left click only. Modified clicks (Ctrl/Cmd/Shift/Alt) are
 * left to the browser, which opens a new window or tab, so no in-app tab opens then.
 */
export function openTabOnClick(id: string, after?: () => void) {
  return (e: MouseLike) => {
    if (!isPlainClick(e)) return
    openTab(id)
    after?.()
  }
}

function writeIfChanged(ids: string[]) {
  if (JSON.stringify(ids) !== readStored()) writeStored(ids)
}
