import { describe, expect, it } from 'vitest'
import nextConfig from '../next.config'
import { activeSection, HOME_SECTIONS, sectionFromHash, sectionHref, sectionRedirects } from '@/lib/sections'

describe('HOME_SECTIONS', () => {
  it('lists the home page sections in page order, without education', () => {
    expect(HOME_SECTIONS).toEqual(['about', 'experience', 'skills', 'projects', 'contact'])
  })

  it('builds in-page hrefs on the language home', () => {
    expect(sectionHref('en', 'skills')).toBe('/en#skills')
    expect(sectionHref('vi', 'about')).toBe('/vi#about')
  })
})

describe('sectionRedirects', () => {
  it('sends each old per-page route to its section of the home page, temporarily', () => {
    expect(sectionRedirects(['en', 'vi'])).toEqual([
      { source: '/:lang(en|vi)/about', destination: '/:lang', permanent: false },
      { source: '/:lang(en|vi)/experience', destination: '/:lang#experience', permanent: false },
      { source: '/:lang(en|vi)/skills', destination: '/:lang#skills', permanent: false },
      { source: '/:lang(en|vi)/projects', destination: '/:lang#projects', permanent: false },
      { source: '/:lang(en|vi)/contact', destination: '/:lang#contact', permanent: false },
    ])
  })

  it('is wired into next.config; the bare / is no longer a static redirect (proxy.ts picks the language)', async () => {
    const redirects = await nextConfig.redirects!()
    expect(redirects.some((r) => r.source === '/')).toBe(false)
    expect(redirects).toEqual(sectionRedirects(['en', 'vi']))
  })

  it('sends the old About page to the home page itself (no hash), and does not redirect the removed education page', () => {
    const redirects = sectionRedirects(['en', 'vi'])
    expect(redirects.find((r) => r.source.endsWith('/about'))?.destination).toBe('/:lang')
    expect(redirects.some((r) => r.source.endsWith('/education'))).toBe(false)
  })
})

describe('sectionFromHash', () => {
  it('reads a known section id from a location hash', () => {
    expect(sectionFromHash('#skills')).toBe('skills')
    expect(sectionFromHash('contact')).toBe('contact')
    expect(sectionFromHash('#about')).toBe('about')
  })

  it('ignores empty, unknown or removed ids', () => {
    expect(sectionFromHash('')).toBeUndefined()
    expect(sectionFromHash('#')).toBeUndefined()
    expect(sectionFromHash('#education')).toBeUndefined()
    expect(sectionFromHash('#tech-stack')).toBeUndefined()
  })
})

describe('activeSection (scroll-spy)', () => {
  // Section tops relative to the top of an 800px-high editor pane.
  const at = (offset: number) =>
    [
      { id: 'about', top: 0 },
      { id: 'experience', top: 900 },
      { id: 'skills', top: 2000 },
      { id: 'projects', top: 2800 },
      { id: 'contact', top: 4000 },
    ].map((s) => ({ ...s, top: s.top - offset }))

  it('is the first section at the top of the page', () => {
    expect(activeSection(at(0), { height: 800, atBottom: false })).toBe('about')
  })

  it('is the last section whose top has passed the reading line (a third down the pane)', () => {
    expect(activeSection(at(500), { height: 800, atBottom: false })).toBe('about')
    expect(activeSection(at(700), { height: 800, atBottom: false })).toBe('experience')
    expect(activeSection(at(2000), { height: 800, atBottom: false })).toBe('skills')
    expect(activeSection(at(2600), { height: 800, atBottom: false })).toBe('projects')
  })

  it('is the last section when the pane is scrolled to the bottom, even if it is short', () => {
    expect(activeSection(at(3500), { height: 800, atBottom: true })).toBe('contact')
  })

  it('is the first section while every section is still below the line, and undefined with no sections', () => {
    expect(activeSection(at(-1000), { height: 800, atBottom: false })).toBe('about')
    expect(activeSection([], { height: 800, atBottom: false })).toBeUndefined()
  })
})
