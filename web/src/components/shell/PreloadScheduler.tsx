'use client'

// Internal Next path, tied to the pinned Next 16.4.5 (public `router.prefetch` has no `kind` type export); a test
// checks it still resolves, so an upgrade fails loudly.
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { PreloadTask, PreloadTier } from '@/lib/preload/plan'
import { createPreloadQueue, type PreloadQueue } from '@/lib/preload/queue'
import { doneStore, isConstrained, prefetchFile, rscLanded, skipHeavy, whenIdle } from './preloadBrowser'

/** The mounted queue, for `preloadIntent` (explorer rows call it on hover / focus / touch). */
let current: PreloadQueue | undefined

/** Navigation intent on a link to `href` (hover, keyboard focus, touch): prefetch it now, ahead of the queue. */
export function preloadIntent(href: string) {
  current?.bump({ kind: 'route', url: href })
}

/** Handlers for a link the scheduler owns (`prefetch={false}`): intent jumps the queue. */
export const intentHandlers = (href: string) => {
  const on = () => preloadIntent(href)
  return { onMouseEnter: on, onFocus: on, onTouchStart: on }
}

/**
 * The background preloader, mounted once in the shell: fetches the site in the owner's order (see
 * lib/preload/plan.ts) so that, after the first load, opening any page is a cache hit. Routes go into Next's router
 * cache (`router.prefetch`, full payload: the same as `<Link prefetch>`); images and PDFs into the browser cache.
 * Starts after hydration, pauses while the tab is hidden, honours data saver / 2g (tier 1 only), skips the PDFs on a
 * slow link and never fetches a URL twice. The other-language version of the current page is prefetched by
 * <LangSwitch> on its own, first.
 * Production only: Next does not prefetch in `next dev`.
 */
export function PreloadScheduler({
  tiers,
  enabled = process.env.NODE_ENV === 'production',
}: {
  tiers: PreloadTier[]
  /** Off in `next dev` and tests by default. */
  enabled?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!enabled) return
    const here = pathname.replace(/\/$/, '') || '/'
    const done = doneStore()
    // The page being shown is already in the router cache.
    done.add(`route ${here}`)
    const run = (task: PreloadTask): Promise<unknown> => {
      if (task.kind !== 'route') return prefetchFile(task)
      router.prefetch(task.url, { kind: PrefetchKind.FULL })
      return rscLanded(task.url)
    }
    const queue = createPreloadQueue(tiers, { run, whenIdle, done, constrained: isConstrained(), skip: (t) => skipHeavy(t) })
    current = queue
    const sync = () => queue.setPaused(document.hidden)
    sync()
    queue.start()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      queue.stop()
      if (current === queue) current = undefined
    }
    // Once per mount (a language switch mounts a new shell): later navigations do not restart the queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, tiers, enabled])

  return null
}
