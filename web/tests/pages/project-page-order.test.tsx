// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const IMPORT_TIMEOUT = 60_000
const README = `# Caro Web App

[![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org/)

Body paragraph.
`

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/projects/caro-app',
  useRouter: () => ({ prefetch: () => {}, push: () => {} }),
  notFound: () => {
    throw new Error('notFound')
  },
}))
vi.mock('@/lib/projectReadmeManifest', () => ({
  loadProjectReadme: (slug: string) =>
    slug === 'caro-app' ? { repoUrl: 'https://github.com/voanhduy1710/Caro-app', markdown: README, images: [], lang: 'en' } : undefined,
}))

/** True if `a` comes before `b` in document order. */
const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('project page: links row right after the title', () => {
  const previous = process.env.CONTENT_DIR
  let ProjectPage: typeof import('@/app/[lang]/projects/[slug]/page').default

  beforeAll(async () => {
    process.env.CONTENT_DIR = 'tests/fixtures'
    vi.resetModules()
    ;({ default: ProjectPage } = await import('@/app/[lang]/projects/[slug]/page'))
  }, IMPORT_TIMEOUT)
  afterAll(() => {
    if (previous === undefined) delete process.env.CONTENT_DIR
    else process.env.CONTENT_DIR = previous
  })
  afterEach(cleanup)

  async function page(slug: string) {
    const el = await ProjectPage({ params: Promise.resolve({ lang: 'en', slug }) } as never)
    return render(el).container
  }

  it('with a README: README H1 -> links row -> README badges and body; back link and group above', async () => {
    const c = await page('caro-app')
    const h1s = c.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe('Caro Web App')
    const links = c.querySelector('[data-project-links]')!
    expect(links.textContent).toContain('Repository')
    expect(h1s[0].nextElementSibling).toBe(links.parentElement)
    const body = [...c.querySelectorAll('.markdown-body p')].find((p) => p.textContent === 'Body paragraph.')!
    const badge = c.querySelector('.markdown-body a[href="https://nodejs.org/"]')!
    expect(before(links, badge)).toBe(true)
    expect(before(links, body)).toBe(true)
    const back = [...c.querySelectorAll('a')].find((a) => a.textContent?.includes('All projects'))!
    expect(before(back, h1s[0])).toBe(true)
  })

  it('without a README: header title -> links row -> the rest', async () => {
    const c = await page('data-analyst-portfolio')
    const h1 = c.querySelector('h1')!
    const links = c.querySelector('[data-project-links]')!
    expect(h1.nextElementSibling).toBe(links)
    expect(c.querySelectorAll('[data-project-links]')).toHaveLength(1)
  })
})
