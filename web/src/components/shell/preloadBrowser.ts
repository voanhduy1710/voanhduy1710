import type { PreloadTask } from '@/lib/preload/plan'

/**
 * Browser side of the background preloader (see PreloadScheduler.tsx): telling when a route prefetch has landed,
 * prefetching files, idle callbacks, the data-saver check and the "already done" stores.
 */

/** How long a route prefetch may take before the queue moves on anyway (Next keeps fetching it in order). */
export const ROUTE_TIMEOUT_MS = 5000
/** Same for a file (a PDF on a slow connection); the browser keeps downloading it at low priority. */
export const FILE_TIMEOUT_MS = 15000
/** Route-tree replies are about 1 KB; the page payload a click needs is larger. */
const PAYLOAD_MIN_BYTES = 2000

type Seen = { count: number; maxBytes: number }
const seen = new Map<string, Seen>()
const waiters = new Map<string, Set<() => void>>()
let observing = false

const landed = (s: Seen | undefined) => !!s && (s.maxBytes >= PAYLOAD_MIN_BYTES || s.count >= 2)

/**
 * Next's `router.prefetch` returns nothing, so the RSC replies are watched through Resource Timing: a route counts as
 * prefetched once a `?_rsc=` reply for its path has arrived that is larger than a route tree, or a second one has.
 */
function observeRsc() {
  if (observing || typeof PerformanceObserver === 'undefined') return
  observing = true
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.name.includes('_rsc=')) continue
        let path: string
        try {
          path = new URL(e.name).pathname
        } catch {
          continue
        }
        const s = seen.get(path) ?? { count: 0, maxBytes: 0 }
        s.count++
        s.maxBytes = Math.max(s.maxBytes, (e as PerformanceResourceTiming).decodedBodySize || 0)
        seen.set(path, s)
        if (landed(s)) {
          for (const w of waiters.get(path) ?? []) w()
          waiters.delete(path)
        }
      }
    }).observe({ type: 'resource', buffered: true })
  } catch {
    // No Resource Timing: every route task simply waits for its timeout.
  }
}

/** Resolves when the RSC payload for `path` has arrived, or after `timeoutMs`. */
export function rscLanded(path: string, timeoutMs = ROUTE_TIMEOUT_MS): Promise<void> {
  observeRsc()
  if (landed(seen.get(path))) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      waiters.get(path)?.delete(done)
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    let set = waiters.get(path)
    if (!set) waiters.set(path, (set = new Set()))
    set.add(done)
  })
}

let linkPrefetch: boolean | undefined

/** `<link rel="prefetch">` is unsupported in Safari: neither load nor error would fire. Detected once. */
function supportsLinkPrefetch(): boolean {
  if (linkPrefetch === undefined) {
    try {
      linkPrefetch = !!(document.createElement('link').relList as DOMTokenList | undefined)?.supports?.('prefetch')
    } catch {
      linkPrefetch = false
    }
  }
  return linkPrefetch
}

/**
 * Low-priority prefetch of a file: `<link rel="prefetch">` (the browser keeps it for about five minutes even when it
 * is not cacheable, and the page's own `<img>` or PDF `<iframe>` then loads it without a network wait). Where that is
 * unsupported (Safari) an image goes through a low-priority `Image()` and a PDF through a low-priority `fetch`. The
 * timeout is a safety net: the queue moves on, the browser keeps downloading.
 */
export function prefetchFile(task: PreloadTask, timeoutMs = FILE_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    if (supportsLinkPrefetch()) {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      if (task.kind === 'image') link.setAttribute('as', 'image')
      link.href = task.url
      link.setAttribute('fetchpriority', 'low')
      link.dataset.preload = task.kind
      link.onload = done
      link.onerror = done
      document.head.appendChild(link)
    } else if (task.kind === 'image') {
      const img = new Image()
      img.fetchPriority = 'low'
      img.decoding = 'async'
      img.onload = done
      img.onerror = done
      img.src = task.url
    } else {
      fetch(task.url, { priority: 'low' } as RequestInit).then(done, done)
    }
  })
}

/** requestIdleCallback with a timeout (so a busy page still makes progress); a short timer where it is missing. */
export function whenIdle(cb: () => void, timeout = 2000): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => cb(), { timeout })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(cb, 200)
  return () => window.clearTimeout(id)
}

type Connection = { saveData?: boolean; effectiveType?: string; downlink?: number }

/** Below this downlink (Mb/s) the certificate PDFs (about 1.7 MB in all) are not preloaded. */
export const PDF_MIN_DOWNLINK = 5

/**
 * The PDFs are the bulk of the preload. On a slow link (Chrome's "Slow 4G" reports 4g with ~1.6 Mb/s) they would take
 * the bandwidth a page prefetch or an EN <-> VI switch needs for several seconds, so they are left to the iframe.
 * Without the Network Information API (Safari, Firefox) they are preloaded.
 */
export function skipHeavy(
  task: PreloadTask,
  nav: { connection?: Connection } = navigator as Navigator & { connection?: Connection },
): boolean {
  const d = nav.connection?.downlink
  return task.kind === 'document' && typeof d === 'number' && d < PDF_MIN_DOWNLINK
}

/** Data saver on, or a 2g-class connection: preload only the most important tier. */
export function isConstrained(nav: { connection?: Connection } = navigator as Navigator & { connection?: Connection }): boolean {
  const c = nav.connection
  return !!c && (c.saveData === true || c.effectiveType === 'slow-2g' || c.effectiveType === '2g')
}

/**
 * Done keys. Routes live in the router's in-memory cache, so they are remembered in memory only (shared by every
 * mount, e.g. across a language switch; a reload starts over, as the router cache does). Files are in the browser's
 * cache, so they are remembered in sessionStorage for the session.
 */
const doneRoutes = new Map<string, number>()
/** Next's router cache drops a prefetched entry after about 5 minutes: a route is done for less than that. */
export const ROUTE_TTL_MS = 4 * 60 * 1000
const FILES_KEY = 'vsc-preloaded'

function readFiles(): Set<string> {
  try {
    const v: unknown = JSON.parse(sessionStorage.getItem(FILES_KEY) ?? '[]')
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function doneStore() {
  const files = readFiles()
  return {
    has: (key: string) => {
      const at = doneRoutes.get(key)
      if (at !== undefined) {
        if (Date.now() - at < ROUTE_TTL_MS) return true
        doneRoutes.delete(key)
      }
      return files.has(key)
    },
    add(key: string) {
      if (key.startsWith('route ')) {
        doneRoutes.set(key, Date.now())
        return
      }
      files.add(key)
      try {
        sessionStorage.setItem(FILES_KEY, JSON.stringify([...files]))
      } catch {
        // Storage full or blocked: dedupe within this mount only.
      }
    },
  }
}

/** Test hook: forget what this module has seen. */
export function resetPreloadBrowserState() {
  seen.clear()
  waiters.clear()
  doneRoutes.clear()
  linkPrefetch = undefined
}
