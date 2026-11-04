// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { intentHandlers, PreloadScheduler, preloadIntent } from '@/components/shell/PreloadScheduler'
import { doneStore, isConstrained, prefetchFile, resetPreloadBrowserState, ROUTE_TTL_MS, skipHeavy } from '@/components/shell/preloadBrowser'
import type { PreloadTier } from '@/lib/preload/plan'

const prefetch = vi.fn()
vi.mock('next/navigation', () => ({ usePathname: () => '/en', useRouter: () => ({ prefetch, push: () => {} }) }))

const tiers: PreloadTier[] = [
  { id: 1, name: 'public', tasks: [{ kind: 'route', url: '/en' }], concurrency: 1, idle: false },
  {
    id: 2,
    name: 'My works',
    tasks: [
      { kind: 'route', url: '/en/projects/a' },
      { kind: 'route', url: '/en/projects/b' },
      { kind: 'route', url: '/en/projects/c' },
    ],
    concurrency: 2,
    idle: false,
  },
]

beforeEach(() => {
  prefetch.mockClear()
  sessionStorage.clear()
  resetPreloadBrowserState()
})
afterEach(() => {
  cleanup()
  document.head.querySelectorAll('link[data-preload]').forEach((l) => l.remove())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('<PreloadScheduler>', () => {
  it('mounts without errors and renders nothing; disabled by default outside production', () => {
    const { container } = render(<PreloadScheduler tiers={tiers} />)
    expect(container.innerHTML).toBe('')
    expect(prefetch).not.toHaveBeenCalled()
  })

  it('skips the current page and prefetches tier 2 two at a time (full payload)', () => {
    render(<PreloadScheduler tiers={tiers} enabled />)
    // `/en` is the page being shown: not fetched. Tier 2 starts at once, 2 in flight.
    expect(prefetch.mock.calls.map((c) => c[0])).toEqual(['/en/projects/a', '/en/projects/b'])
    expect(prefetch.mock.calls[0][1]).toEqual({ kind: 'full' })
  })

  it('hover intent jumps the queue, once', async () => {
    render(<PreloadScheduler tiers={tiers} enabled />)
    const h = intentHandlers('/en/projects/c')
    h.onMouseEnter()
    preloadIntent('/en/projects/c')
    await Promise.resolve()
    await Promise.resolve()
    expect(prefetch.mock.calls.map((c) => c[0]).filter((u) => u === '/en/projects/c')).toHaveLength(1)
  })

  it('unmounting stops the queue and intent', async () => {
    const { unmount } = render(<PreloadScheduler tiers={tiers} enabled />)
    unmount()
    preloadIntent('/en/projects/c')
    await Promise.resolve()
    expect(prefetch.mock.calls.map((c) => c[0])).not.toContain('/en/projects/c')
  })
})

describe('preloadBrowser', () => {
  it('isConstrained: data saver or 2g only', () => {
    expect(isConstrained({})).toBe(false)
    expect(isConstrained({ connection: { effectiveType: '4g' } })).toBe(false)
    expect(isConstrained({ connection: { saveData: true, effectiveType: '4g' } })).toBe(true)
    expect(isConstrained({ connection: { effectiveType: '2g' } })).toBe(true)
    expect(isConstrained({ connection: { effectiveType: 'slow-2g' } })).toBe(true)
  })

  it('skipHeavy: PDFs only on a fast link or without connection info; pages always', () => {
    const pdf = { kind: 'document' as const, url: '/content/certificates/1.pdf' }
    const page = { kind: 'route' as const, url: '/en/cv' }
    expect(skipHeavy(pdf, { connection: { effectiveType: '4g', downlink: 1.55 } })).toBe(true)
    expect(skipHeavy(pdf, { connection: { effectiveType: '4g', downlink: 10 } })).toBe(false)
    expect(skipHeavy(pdf, {})).toBe(false)
    expect(skipHeavy(page, { connection: { downlink: 0.4 } })).toBe(false)
  })

  it('doneStore: files persist in sessionStorage, routes stay in memory', () => {
    const a = doneStore()
    a.add('route /en/cv')
    a.add('document /content/certificates/1.pdf')
    expect(JSON.parse(sessionStorage.getItem('vsc-preloaded')!)).toEqual(['document /content/certificates/1.pdf'])
    const b = doneStore()
    expect(b.has('route /en/cv')).toBe(true)
    expect(b.has('document /content/certificates/1.pdf')).toBe(true)
    resetPreloadBrowserState()
    expect(doneStore().has('route /en/cv')).toBe(false)
  })

  it('prefetchFile adds a low-priority <link rel=prefetch> and settles on load', async () => {
    vi.spyOn(DOMTokenList.prototype, 'supports').mockReturnValue(true)
    const p = prefetchFile({ kind: 'image', url: '/content/x.webp' })
    const link = document.head.querySelector<HTMLLinkElement>('link[data-preload="image"]')!
    expect(link.rel).toBe('prefetch')
    expect(link.getAttribute('as')).toBe('image')
    expect(link.getAttribute('fetchpriority')).toBe('low')
    link.onload?.(new Event('load'))
    await expect(p).resolves.toBeUndefined()
  })

  describe('prefetchFile without link prefetch support (Safari)', () => {
    beforeEach(() => {
      vi.spyOn(DOMTokenList.prototype, 'supports').mockReturnValue(false)
    })

    it('loads an image through a low-priority Image() and settles on load', async () => {
      const made: HTMLImageElement[] = []
      const Real = globalThis.Image
      vi.stubGlobal(
        'Image',
        class extends Real {
          constructor() {
            super()
            made.push(this)
          }
        },
      )
      const p = prefetchFile({ kind: 'image', url: '/content/x.webp' })
      expect(document.head.querySelector('link[data-preload]')).toBeNull()
      expect(made).toHaveLength(1)
      expect(made[0].getAttribute('src')).toBe('/content/x.webp')
      expect(made[0].decoding).toBe('async')
      made[0].onload?.(new Event('load'))
      await expect(p).resolves.toBeUndefined()
    })

    it('fetches a PDF at low priority and settles on the response, or on an error', async () => {
      const f = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('offline'))
      vi.stubGlobal('fetch', f)
      await expect(prefetchFile({ kind: 'document', url: '/c/1.pdf' })).resolves.toBeUndefined()
      expect(f).toHaveBeenCalledWith('/c/1.pdf', { priority: 'low' })
      await expect(prefetchFile({ kind: 'document', url: '/c/2.pdf' })).resolves.toBeUndefined()
    })

    it('still gives up after the timeout when nothing fires', async () => {
      vi.useFakeTimers()
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
      const p = prefetchFile({ kind: 'document', url: '/c/3.pdf' }, 50)
      vi.advanceTimersByTime(50)
      await expect(p).resolves.toBeUndefined()
    })
  })

  it('route done keys expire after the TTL so hover can prefetch again', () => {
    vi.useFakeTimers()
    const d = doneStore()
    d.add('route /en/cv')
    vi.advanceTimersByTime(ROUTE_TTL_MS - 1000)
    expect(d.has('route /en/cv')).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(d.has('route /en/cv')).toBe(false)
  })

  it('the internal Next PrefetchKind import still resolves (fails loudly on a Next upgrade)', async () => {
    const m = await import('next/dist/client/components/router-reducer/router-reducer-types')
    expect(m.PrefetchKind.FULL).toBe('full')
  })
})
