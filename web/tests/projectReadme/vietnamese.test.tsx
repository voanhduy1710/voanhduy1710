// @vitest-environment jsdom
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ProjectReadme } from '@/components/ProjectReadme'

const IMPORT_TIMEOUT = 60_000
const REPO = 'https://github.com/voanhduy1710/Caro-app'

/** Shaped like the real Caro-app READMEVN.md: switch line after the H1, an in-page link to a Vietnamese heading. */
const CARO_VI = `# [Caro Web App](https://league-of-caro.vercel.app/)

> 🇬🇧 English version: [README.md](README.md)

Có thể dùng relay TURN (xem [Biến môi trường](#3-cấu-hình-biến-môi-trường))

> Một trích dẫn thường vẫn được giữ.

![Xem trước 1](public/preview_images/Preview_1.png)

### 3. Cấu hình biến môi trường
`
const CARO_EN = `# [Caro Web App](https://league-of-caro.vercel.app/)

Uses a TURN relay (see [Environment](#3-configure-environment-variables))

![Preview 1](public/preview_images/Preview_1.png)

### 3. Configure environment variables
`
const IMAGES = ['public/preview_images/Preview_1.png.webp']

afterEach(cleanup)

describe('ProjectReadme: READMEVN.md on /vi', () => {
  const props = { slug: 'caro-app', repoUrl: REPO, images: IMAGES }

  it('drops the "English version" switch line, keeps other blockquotes, the shared image and the Vietnamese anchor', () => {
    const html = renderToStaticMarkup(<ProjectReadme {...props} markdown={CARO_VI} dropLanguageLink />)
    expect(html).not.toContain('English version')
    expect(html).not.toContain('/blob/main/README.md')
    expect(html).toContain('Một trích dẫn thường vẫn được giữ.')
    expect(html).toContain('src="/content/project-readmes/caro-app/public/preview_images/Preview_1.png.webp"')
    // github-slugger ids: the in-page link resolves to the heading.
    expect(html).toContain('<h3 id="3-cấu-hình-biến-môi-trường">')
    expect(html).toContain('href="#3-cấu-hình-biến-môi-trường"')
  })

  it('keeps the switch line when not asked to drop it (and /en output is unchanged)', () => {
    expect(renderToStaticMarkup(<ProjectReadme {...props} markdown={CARO_VI} />)).toContain('English version')
    const en = renderToStaticMarkup(<ProjectReadme {...props} markdown={CARO_EN} />)
    expect(en).toBe(renderToStaticMarkup(<ProjectReadme {...props} markdown={CARO_EN} dropLanguageLink />))
    expect(en).toContain('<h3 id="3-configure-environment-variables">')
  })
})

describe('loadProjectReadme(slug, lang)', () => {
  const previous = process.env.CONTENT_DIR
  let dir: string
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'readme-vi-'))
    mkdirSync(join(dir, 'project-readmes'))
    writeFileSync(join(dir, 'project-readmes', 'caro-app.md'), CARO_EN)
    writeFileSync(join(dir, 'project-readmes', 'caro-app.vi.md'), CARO_VI)
    writeFileSync(join(dir, 'project-readmes', 'bi.md'), '# BI\n')
    writeFileSync(
      join(dir, 'project-readmes.json'),
      JSON.stringify({ 'caro-app': { repoUrl: REPO, images: IMAGES, vi: true }, bi: { repoUrl: 'https://github.com/o/bi', images: [] } }),
    )
    process.env.CONTENT_DIR = dir
    vi.resetModules()
  })
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
    if (previous === undefined) delete process.env.CONTENT_DIR
    else process.env.CONTENT_DIR = previous
  })

  it('serves READMEVN.md on vi when synced, else the English README; en always gets README.md', async () => {
    const { loadProjectReadme, parseProjectReadmeManifest } = await import('@/lib/projectReadmeManifest')
    expect(loadProjectReadme('caro-app', 'vi')).toMatchObject({ lang: 'vi', markdown: CARO_VI, images: IMAGES })
    expect(loadProjectReadme('caro-app', 'en')).toMatchObject({ lang: 'en', markdown: CARO_EN })
    expect(loadProjectReadme('bi', 'vi')).toMatchObject({ lang: 'en', markdown: '# BI\n' })
    expect(() => parseProjectReadmeManifest('{"a":{"repoUrl":"u","images":[],"vi":"yes"}}')).toThrow(/vi\?/)
  })
})

describe('project page on /vi', () => {
  const previous = process.env.CONTENT_DIR
  let ProjectPage: typeof import('@/app/[lang]/projects/[slug]/page').default

  beforeAll(async () => {
    process.env.CONTENT_DIR = 'tests/fixtures'
    vi.resetModules()
    vi.doMock('next/navigation', () => ({
      usePathname: () => '/vi/projects/caro-app',
      useRouter: () => ({ prefetch: () => {}, push: () => {} }),
      notFound: () => {
        throw new Error('notFound')
      },
    }))
    vi.doMock('@/lib/projectReadmeManifest', () => ({
      loadProjectReadme: (slug: string, lang: 'en' | 'vi') => {
        if (slug === 'caro-app') return { repoUrl: REPO, images: IMAGES, vi: true, lang, markdown: lang === 'vi' ? CARO_VI : CARO_EN }
        if (slug === 'qandastudy-booking') {
          return { repoUrl: 'https://github.com/o/r', images: [], lang: 'en', markdown: '# Qanda\n\nEnglish only.\n' }
        }
        return undefined
      },
    }))
    ProjectPage = (await import('@/app/[lang]/projects/[slug]/page')).default
  }, IMPORT_TIMEOUT)
  afterAll(() => {
    vi.doUnmock('next/navigation')
    vi.doUnmock('@/lib/projectReadmeManifest')
    if (previous === undefined) delete process.env.CONTENT_DIR
    else process.env.CONTENT_DIR = previous
  })

  const renderPage = async (lang: string, slug: string) =>
    render(await ProjectPage({ params: Promise.resolve({ lang, slug }) } as Parameters<typeof ProjectPage>[0])).container

  it('with READMEVN.md: Vietnamese body, no English-only note, no switch line, h1 then the links row', async () => {
    const page = await renderPage('vi', 'caro-app')
    expect(page.textContent).toContain('Có thể dùng relay TURN')
    expect(page.textContent).not.toContain('README gốc bằng tiếng Anh')
    expect(page.textContent).not.toContain('English version')
    const h1s = page.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0].nextElementSibling?.querySelector('[data-project-links]')).not.toBeNull()
  })

  it('without READMEVN.md: the English README with the note', async () => {
    const page = await renderPage('vi', 'qandastudy-booking')
    expect(page.textContent).toContain('English only.')
    expect(page.textContent).toContain('README gốc bằng tiếng Anh')
  })

  it('/en is unchanged: the English README, no note', async () => {
    const page = await renderPage('en', 'caro-app')
    expect(page.textContent).toContain('Uses a TURN relay')
    expect(page.textContent).not.toContain('README gốc bằng tiếng Anh')
  })
})
