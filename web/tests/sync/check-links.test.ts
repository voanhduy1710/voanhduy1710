import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildRoutes, certificateRoutes, findBrokenLinks, missingRoutes, REQUIRED_ROUTES } from '../../scripts/check-links'

const temps: string[] = []
afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })))
})

function put(root: string, rel: string, data: string): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), data)
}

async function site(pages: Record<string, string>): Promise<{ appDir: string; publicDir: string }> {
  const d = await mkdtemp(join(tmpdir(), 'check-links-'))
  temps.push(d)
  const appDir = join(d, '.next', 'server', 'app')
  const publicDir = join(d, 'public')
  for (const [rel, html] of Object.entries(pages)) put(appDir, rel, html)
  put(publicDir, 'logos/Google Cloud Run.png', 'png')
  put(publicDir, 'content/CV_Vo Anh Duy_EN.pdf', 'pdf')
  return { appDir, publicDir }
}

const ROUTES = ['/en', '/en/contact', '/vi', '/']

describe('findBrokenLinks', () => {
  it('accepts absolute, mailto, tel, anchors, /_next assets, routes and exact public files', async () => {
    const html = [
      '<a href="https://github.com/x">g</a>',
      '<a href="mailto:a@b.c">m</a> <a href="tel:+84">t</a> <a href="#top">top</a>',
      '<script src="/_next/static/chunks/a.js"></script>',
      '<a href="/en/contact">c</a> <a href="/vi/">vi</a> <a href="/">root</a>',
      '<img src="/logos/Google%20Cloud%20Run.png"> <a href="/content/CV_Vo%20Anh%20Duy_EN.pdf?x=1">cv</a>',
      '<a href="/en?lang=1&amp;b=2">q</a>',
    ].join('\n')
    const s = await site({ 'en.html': html })
    expect(await findBrokenLinks({ ...s, routes: ROUTES })).toEqual([])
  })

  it('accepts synced project-README images, whose path segments are fully encoded (spaces, #, &)', async () => {
    const s = await site({ 'en/projects/qanda.html': '<img src="/content/project-readmes/qanda/1.%20App/a%20%231%20%26%20b.png">' })
    put(s.publicDir, 'content/project-readmes/qanda/1. App/a #1 & b.png', 'png')
    expect(await findBrokenLinks({ ...s, routes: ROUTES })).toEqual([])
    const missing = await site({ 'en.html': '<img src="/content/project-readmes/qanda/1.%20App/gone.png">' })
    expect(await findBrokenLinks({ ...missing, routes: ROUTES })).toHaveLength(1)
  })

  it('ignores /api/* route handlers (dynamic, never prerendered), but not a look-alike path', async () => {
    const s = await site({ 'en.html': '<a href="/api/contact">api</a> <a href="/apis/x">x</a>' })
    expect(await findBrokenLinks({ ...s, routes: ROUTES })).toEqual([{ page: 'en.html', attr: 'href', url: '/apis/x' }])
  })

  it('lists README-relative hrefs, unknown routes, missing or wrongly-cased files', async () => {
    const html = [
      '<a href="CV_Vo%20Anh%20Duy_EN.pdf">cv</a>',
      '<a href="/en/nope">x</a>',
      '<img src="/logos/google cloud run.png">',
      '<img src="/content/CV_Vo%20Anh%20Duy_VN.pdf">',
      '<a href="//evil.example/x">p</a>',
      '<a href="javascript:alert(1)">j</a>',
    ].join('\n')
    const s = await site({ 'en/contact.html': html })
    const broken = await findBrokenLinks({ ...s, routes: ROUTES })
    expect(broken).toEqual([
      { page: 'en/contact.html', attr: 'href', url: 'CV_Vo%20Anh%20Duy_EN.pdf' },
      { page: 'en/contact.html', attr: 'href', url: '/en/nope' },
      { page: 'en/contact.html', attr: 'src', url: '/logos/google cloud run.png' },
      { page: 'en/contact.html', attr: 'src', url: '/content/CV_Vo%20Anh%20Duy_VN.pdf' },
      { page: 'en/contact.html', attr: 'href', url: '//evil.example/x' },
      { page: 'en/contact.html', attr: 'href', url: 'javascript:alert(1)' },
    ])
  })
})

describe('findBrokenLinks: certificate pages', () => {
  it('accepts a certificate route and its /content/certificates PDF (with #view=FitH); a missing PDF is broken', async () => {
    const html = [
      '<a href="/en/certifications/1">c</a>',
      '<iframe src="/content/certificates/1.pdf#view=FitH"></iframe>',
      '<a href="/content/certificates/1.pdf" download="A.pdf">d</a>',
      '<iframe src="/content/certificates/2.pdf#view=FitH"></iframe>',
    ].join('\n')
    const s = await site({ 'en/certifications/1.html': html })
    put(s.publicDir, 'content/certificates/1.pdf', 'pdf')
    expect(await findBrokenLinks({ ...s, routes: [...ROUTES, '/en/certifications/1'] })).toEqual([
      { page: 'en/certifications/1.html', attr: 'src', url: '/content/certificates/2.pdf#view=FitH' },
    ])
  })
})

describe('buildRoutes', () => {
  it('reads prerendered routes and parameter-free redirect sources', async () => {
    const d = await mkdtemp(join(tmpdir(), 'check-links-'))
    temps.push(d)
    put(d, 'prerender-manifest.json', JSON.stringify({ routes: { '/en': {}, '/en/cv': {} } }))
    put(d, 'routes-manifest.json', JSON.stringify({ redirects: [{ source: '/:path+/' }, { source: '/' }] }))
    expect(buildRoutes(d)).toEqual(['/en', '/en/cv', '/'])
  })
})

describe('missingRoutes', () => {
  it('requires the profile README preview and the five config-file views in both languages', () => {
    expect(REQUIRED_ROUTES).toEqual([
      '/en/readme',
      '/en/files/gitignore',
      '/en/files/vercelignore',
      '/en/files/next.config.ts',
      '/en/files/package.json',
      '/en/files/tsconfig.json',
      '/vi/readme',
      '/vi/files/gitignore',
      '/vi/files/vercelignore',
      '/vi/files/next.config.ts',
      '/vi/files/package.json',
      '/vi/files/tsconfig.json',
    ])
  })

  it('requires a certificate page per language for each synced PDF', () => {
    expect(certificateRoutes(new Set([1, 7]))).toEqual(['/en/certifications/1', '/en/certifications/7', '/vi/certifications/1', '/vi/certifications/7'])
    expect(missingRoutes(['/en/certifications/1'], certificateRoutes([1]))).toEqual(['/vi/certifications/1'])
  })

  it('lists the required routes the build did not prerender', () => {
    expect(missingRoutes(['/en', ...REQUIRED_ROUTES])).toEqual([])
    expect(missingRoutes(REQUIRED_ROUTES.filter((r) => r !== '/vi/files/package.json'))).toEqual(['/vi/files/package.json'])
  })
})
