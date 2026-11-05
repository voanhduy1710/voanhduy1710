import { describe, expect, it } from 'vitest'
import { buildNav, type NavProject } from '@/lib/nav'
import { buildPreloadPlan } from '@/lib/preload/plan'

const FULL_STACK = 'Full-Stack Applications & Production Systems'
const ANALYTICS = 'Data Analytics & Business Intelligence'
const bold = (t: string) => [{ kind: 'strong' as const, children: [{ kind: 'text' as const, value: `${t}:` }] }]

const projects: NavProject[] = [
  { slug: 'atino-booking', title: 'Atino Booking', group: FULL_STACK, badges: [] },
  { slug: 'caro-app', title: 'Caro', group: FULL_STACK, badges: [] },
  { slug: 'data-analyst-portfolio', title: 'DA', group: ANALYTICS, badges: [], bullets: [bold('Retail model'), bold('Uber')] },
]
const certs = [
  { no: 1, name: 'Google DA', status: 'Completed' },
  { no: 2, name: 'No PDF yet', status: 'In progress' },
  { no: 3, name: 'IBM', status: 'Completed' },
]
const covers: Record<string, string> = {
  'atino-booking': '/content/project-readmes/atino-booking/a.webp',
  'data-analyst-portfolio': '/content/project-readmes/data-analyst-portfolio/d.webp',
}

describe('buildPreloadPlan', () => {
  const nav = buildNav('en', projects, certs, new Set([1, 3]), '/content/CV_EN.pdf')
  const plan = buildPreloadPlan(nav, (slug) => covers[slug])
  const urls = (id: number) => plan.find((t) => t.id === id)!.tasks.map((t) => `${t.kind} ${t.url}`)

  it('orders home, My works, BI, then the rest; derived from the nav model', () => {
    expect(plan.map((t) => [t.id, t.name, t.concurrency, t.idle])).toEqual([
      [1, 'public', 1, false],
      [2, 'My works', 2, false],
      [3, 'BI projects', 1, true],
      [4, 'rest', 1, true],
    ])
    expect(urls(1)).toEqual(['route /en'])
    // Pages first, then each one's first README image (only where it has one).
    expect(urls(2)).toEqual(['route /en/projects/atino-booking', 'route /en/projects/caro-app', 'image /content/project-readmes/atino-booking/a.webp'])
    // Several BI rows open one page: it is fetched once.
    expect(urls(3)).toEqual(['route /en/projects/data-analyst-portfolio', 'image /content/project-readmes/data-analyst-portfolio/d.webp'])
  })

  it('tier 4: CV, certificate pages (only those with a PDF), config files, then the PDFs', () => {
    const rest = urls(4)
    expect(rest[0]).toBe('route /en/cv')
    expect(rest.slice(1, 3)).toEqual(['route /en/certifications/1', 'route /en/certifications/3'])
    expect(rest.filter((u) => u.startsWith('route /en/files/')).length).toBe(nav.files.length)
    expect(rest.slice(-2)).toEqual(['document /content/certificates/1.pdf', 'document /content/certificates/3.pdf'])
  })

  it('follows the language and drops empty tiers', () => {
    const vi = buildPreloadPlan(buildNav('vi', projects.slice(0, 2)))
    expect(vi.map((t) => t.id)).toEqual([1, 2, 4])
    expect(vi[0].tasks).toEqual([{ kind: 'route', url: '/vi' }])
    expect(vi[1].tasks.every((t) => t.kind === 'route' && t.url.startsWith('/vi/projects/'))).toBe(true)
  })
})

describe('buildPreloadPlan with BI analyses', () => {
  const analyses = [
    { slug: 'uber-trips', title: 'Uber Trips' },
    { slug: 'sql', title: 'SQL' },
  ]
  const nav = buildNav('en', projects.map((p) => (p.group === ANALYTICS ? { ...p, analyses } : p)))
  const cover = (key: string) =>
    ({ 'data-analyst-portfolio': '/c/overview.webp', 'data-analyst-portfolio/uber-trips': '/c/uber.webp' })[key]
  const tier3 = buildPreloadPlan(nav, cover).find((t) => t.id === 3)!

  it('tier 3: the overview page, then each analysis page, then their first images (asked by <slug>/<analysis>)', () => {
    expect(tier3.tasks.map((t) => `${t.kind} ${t.url}`)).toEqual([
      'route /en/projects/data-analyst-portfolio',
      'route /en/projects/data-analyst-portfolio/uber-trips',
      'route /en/projects/data-analyst-portfolio/sql',
      'image /c/overview.webp',
      'image /c/uber.webp',
    ])
  })
})
