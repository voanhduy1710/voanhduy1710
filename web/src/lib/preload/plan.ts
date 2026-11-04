import { certificatePdfUrl } from '@/lib/certificates'
import type { Nav, NavPage } from '@/lib/nav'

/**
 * What the background preloader fetches, in the owner's order. `route`: a page's RSC payload, into the router
 * cache (an instant client navigation later). `image` / `document`: a file into the browser's HTTP / prefetch cache
 * (a README screenshot, a certificate PDF shown in an iframe).
 */
export type PreloadKind = 'route' | 'image' | 'document'
export type PreloadTask = { kind: PreloadKind; url: string }

export type PreloadTier = {
  /** 1 = most important. */
  id: number
  name: string
  tasks: PreloadTask[]
  /** How many of this tier's tasks may be in flight at once. */
  concurrency: number
  /** Start each task only when the browser is idle (else right after the previous tier). */
  idle: boolean
}

const route = (page: NavPage): PreloadTask => ({ kind: 'route', url: page.href })
const unique = (tasks: PreloadTask[]) => [...new Map(tasks.map((t) => [`${t.kind} ${t.url}`, t])).values()]

/** The page's slug, for a project page id (`project:<slug>`). */
const slugOf = (page: NavPage) => (page.id.startsWith('project:') ? page.id.slice('project:'.length) : undefined)

/**
 * The preload tiers, derived from the explorer model (no hard-coded pages):
 * 1. `public/`: the home page (About Me, Work Experience, Skills, Projects, Contact Me are its sections).
 * 2. `src/My works`: every project page plus the first image its README shows, right after tier 1, 2 at a time.
 * 3. `src/BI projects`: the BI project page(s) and their first image, at idle.
 * 4. The rest, at idle, one at a time: the CV, the certificate pages, the config-file pages, then the certificate
 *    PDFs themselves (largest last).
 * `cover(slug)`: served URL of the first image a project's README shows, if any.
 */
export function buildPreloadPlan(nav: Nav, cover: (slug: string) => string | undefined = () => undefined): PreloadTier[] {
  const withCover = (pages: NavPage[]): PreloadTask[] =>
    pages.flatMap((p) => {
      const slug = slugOf(p)
      const img = slug === undefined ? undefined : cover(slug)
      return img ? [route(p), { kind: 'image', url: img }] : [route(p)]
    })
  const biPages = [...new Map(nav.bi.map((r) => [r.page.id, r.page])).values()]
  const certPages = nav.certifications.flatMap((c) => (c.page ? [c.page] : []))
  // Routes first (a click on any of them is instant), then the images, so the pages arrive before their pictures.
  const routesThenImages = (tasks: PreloadTask[]) => [...tasks.filter((t) => t.kind === 'route'), ...tasks.filter((t) => t.kind !== 'route')]
  return [
    { id: 1, name: 'public', tasks: [route(nav.home)], concurrency: 1, idle: false },
    { id: 2, name: 'My works', tasks: unique(routesThenImages(withCover(nav.works))), concurrency: 2, idle: false },
    { id: 3, name: 'BI projects', tasks: unique(routesThenImages(withCover(biPages))), concurrency: 1, idle: true },
    {
      id: 4,
      name: 'rest',
      tasks: unique([
        route(nav.cv),
        ...certPages.map(route),
        ...nav.files.map(route),
        ...nav.certifications.filter((c) => c.page).map((c): PreloadTask => ({ kind: 'document', url: certificatePdfUrl(c.no) })),
      ]),
      concurrency: 1,
      idle: true,
    },
  ].filter((t) => t.tasks.length > 0)
}
