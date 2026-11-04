import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CERTIFICATES_LIST_URL } from '../../scripts/sync-certificates'
import { syncContent } from '../../scripts/sync-content'
import { convertWithSharp, fetchProjectReadmes, IMAGE_BUDGET, type ImageConverter } from '../../scripts/sync-project-readmes'

const PROFILE = `# Profile

<!-- section: projects -->
## Projects

### Full-Stack Applications & Production Systems

<!-- project: caro-app -->
#### [Caro Web App](https://github.com/o/Caro-app)

Short summary.

<!-- project: qanda -->
#### [QandaStudy](https://github.com/o/Previews/tree/main/1.%20Qanda%20App)

### Data Analytics & Business Intelligence

<!-- project: bi -->
#### [BI](https://github.com/o/BI-projects)
<!-- /section -->
`

const RAW = 'https://raw.githubusercontent.com/'
const CDN = 'https://cdn.jsdelivr.net/gh/'

const CARO = `# Caro

[![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org/)

![Preview 1](public/preview_images/Preview_1.png)
<img src="docs/missing.png">
![Logo](logo.svg)
![Up](../outside.png)
![Remote](https://example.com/x.png)
`
const QANDA = '# Qanda\n\n![Preview 0](Preview_0.png)\n'
/** Like the real Portfolio-projects README: spaces, %20 and an encoded `&` in folder and file names. */
const BI = `# BI

[**2. Excel – Adidas Sales**](2.%20Excel%20-%20Addidas%20Sales)

![Adidas](2.%20Excel%20-%20Addidas%20Sales/2.%20Excel%20-%20Adidas%20Sales%20Dashboard.png)

![Supply](4.%20Supply%20chain%20%26%20Sales/4.%20Supply%20chain%20%26%20Sales%20Dashboard.png)

![Model](1.%20Preview%20Atino%20Data%20model.png)
`

/** Files per raw base (`<owner>/<repo>/<ref>/`); a fake GitHub raw + jsDelivr that serves them. */
type Repos = Record<string, Record<string, string | Uint8Array<ArrayBuffer>>>
const REPOS: Repos = {
  'o/Caro-app/main/': { 'README.md': CARO, 'public/preview_images/Preview_1.png': 'png-1', 'logo.svg': '<svg/>' },
  'o/Previews/main/': { '1. Qanda App/README.md': QANDA, '1. Qanda App/Preview_0.png': 'png-0' },
  'o/BI-projects/main/': {
    'README.md': BI,
    '2. Excel - Addidas Sales/2. Excel - Adidas Sales Dashboard.png': 'adidas',
    '4. Supply chain & Sales/4. Supply chain & Sales Dashboard.png': 'supply',
    '1. Preview Atino Data model.png': 'model',
  },
}

type Calls = string[]
function fakeFetch(repos: Repos, opts: { rawDown?: boolean; cdnDown?: boolean; calls?: Calls } = {}): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input)
    opts.calls?.push(url)
    if (url === CERTIFICATES_LIST_URL) return new Response('[]', { status: 200 })
    let key: string | undefined
    let path = ''
    if (url.startsWith(RAW)) {
      if (opts.rawDown) throw new Error('getaddrinfo ENOTFOUND')
      const rest = url.slice(RAW.length)
      key = Object.keys(repos).find((k) => rest.startsWith(k))
      path = key ? rest.slice(key.length) : ''
    } else if (url.startsWith(CDN)) {
      if (opts.cdnDown) return new Response('down', { status: 503 })
      const rest = url.slice(CDN.length)
      key = Object.keys(repos).find((k) => {
        const [owner, repo, ref] = k.split('/')
        return rest.startsWith(`${owner}/${repo}@${ref}/`)
      })
      path = key ? rest.slice(rest.indexOf('/', rest.indexOf('@')) + 1) : ''
    }
    const body = key ? repos[key][decodeURIComponent(path)] : undefined
    return body === undefined ? new Response('404: Not Found', { status: 404 }) : new Response(body, { status: 200 })
  }) as typeof fetch
}

/** Test converter that leaves every image alone (the fake image bytes are not real images). */
const keep: ImageConverter = async (d) => d

describe('fetchProjectReadmes', () => {
  it('fetches the README of every project (root and tree/folder URLs), My works and BI', async () => {
    const calls: Calls = []
    const warnings: string[] = []
    const got = await fetchProjectReadmes(PROFILE, 'README.md', fakeFetch(REPOS, { calls }), (m) => warnings.push(m), keep)
    expect(got.map((p) => p.slug)).toEqual(['caro-app', 'qanda', 'bi'])
    expect(got[0].markdown.toString()).toBe(CARO)
    expect(got[1].repoUrl).toBe('https://github.com/o/Previews/tree/main/1.%20Qanda%20App')
    expect(got[1].images).toEqual([{ path: '1. Qanda App/Preview_0.png', data: Buffer.from('png-0') }])
    expect(calls).toContain(`${RAW}o/Previews/main/1.%20Qanda%20App/README.md`)
    expect(calls).toContain(`${RAW}o/BI-projects/main/README.md`)
    // badges and other absolute images are never downloaded
    expect(calls.some((u) => u.includes('shields.io') || u.includes('example.com'))).toBe(false)
  })

  it('downloads repo-relative raster images; a missing one, an SVG and an escaping path are warnings, not failures', async () => {
    const warnings: string[] = []
    const [caro] = await fetchProjectReadmes(PROFILE, 'README.md', fakeFetch(REPOS), (m) => warnings.push(m), keep)
    expect(caro.images.map((i) => i.path)).toEqual(['public/preview_images/Preview_1.png'])
    expect(warnings).toHaveLength(3)
    expect(warnings.join('\n')).toMatch(/caro-app: skipped README image docs\/missing\.png: cannot fetch it \(GitHub raw HTTP 404, jsDelivr HTTP 404\)/)
    expect(warnings.join('\n')).toMatch(/skipped README image logo\.svg: not a PNG/)
    expect(warnings.join('\n')).toMatch(/skipped README image \.\.\/outside\.png: the path is outside the repo/)
  })

  it('falls back to jsDelivr when GitHub raw is unreachable', async () => {
    const got = await fetchProjectReadmes(PROFILE, 'README.md', fakeFetch(REPOS, { rawDown: true }), () => {}, keep)
    expect(got[1].markdown.toString()).toBe(QANDA)
    expect(got[1].images.map((i) => i.path)).toEqual(['1. Qanda App/Preview_0.png'])
  })

  it('fails naming every source when a README cannot be fetched', async () => {
    const repos = { ...REPOS, 'o/Previews/main/': {} }
    await expect(fetchProjectReadmes(PROFILE, 'README.md', fakeFetch(repos), () => {})).rejects.toThrow(
      /Cannot fetch the README of project qanda \(o\/Previews @ main: 1\. Qanda App\/README\.md\): GitHub raw returned HTTP 404 .*; jsDelivr returned HTTP 404/,
    )
    await expect(fetchProjectReadmes(PROFILE, 'README.md', fakeFetch(REPOS, { rawDown: true, cdnDown: true }), () => {})).rejects.toThrow(
      /GitHub raw returned network error: getaddrinfo ENOTFOUND .*; jsDelivr returned HTTP 503/,
    )
  })

  it('fails naming the project when its repo URL is not a GitHub repo or folder', async () => {
    const profile = PROFILE.replace('https://github.com/o/Caro-app', 'https://gitlab.com/o/Caro-app')
    await expect(fetchProjectReadmes(profile, 'README.md', fakeFetch(REPOS), () => {})).rejects.toThrow(
      'project caro-app: not a GitHub repo or repo-folder URL: https://gitlab.com/o/Caro-app',
    )
  })

  it('skips images past the per-project budget with a warning', async () => {
    const big = new Uint8Array(IMAGE_BUDGET - 10)
    const md = '![a](a.png)\n\n![b](b.png)\n\n![c](c.png)\n'
    const repos: Repos = { ...REPOS, 'o/Caro-app/main/': { 'README.md': md, 'a.png': big, 'b.png': new Uint8Array(20), 'c.png': 'small' } }
    const warnings: string[] = []
    const [caro] = await fetchProjectReadmes(PROFILE, 'README.md', fakeFetch(repos), (m) => warnings.push(m), keep)
    expect(caro.images.map((i) => i.path)).toEqual(['a.png', 'c.png'])
    expect(warnings).toEqual(["Warning: project caro-app: skipped README image b.png: the project's README images would exceed 5 MB"])
  })

  it('BI README: images under folders with spaces, %20 and `&` decode case-exactly and download', async () => {
    const calls: Calls = []
    const got = await fetchProjectReadmes(PROFILE, 'README.md', fakeFetch(REPOS, { calls }), () => {})
    const bi = got.find((p) => p.slug === 'bi')!
    expect(bi.images.map((i) => [i.path, i.data.toString()])).toEqual([
      ['2. Excel - Addidas Sales/2. Excel - Adidas Sales Dashboard.png', 'adidas'],
      ['4. Supply chain & Sales/4. Supply chain & Sales Dashboard.png', 'supply'],
      ['1. Preview Atino Data model.png', 'model'],
    ])
    expect(calls).toContain(`${RAW}o/BI-projects/main/4.%20Supply%20chain%20%26%20Sales/4.%20Supply%20chain%20%26%20Sales%20Dashboard.png`)
  })

  it('converts PNG/JPEG to <path>.webp, keeps GIF/WebP, and counts the converted size against the budget', async () => {
    const md = ['a.png', 'b.JPG', 'c.gif', 'd.webp', 'e.png'].map((f) => `![x](${f})`).join('\n\n')
    const big = new Uint8Array(IMAGE_BUDGET + 100)
    const repos: Repos = {
      ...REPOS,
      'o/Caro-app/main/': { 'README.md': md, 'a.png': big, 'b.JPG': 'jpeg-bytes', 'c.gif': 'gif', 'd.webp': 'webp', 'e.png': 'grows' },
    }
    const seen: string[] = []
    // Shrinks everything to 4 bytes, except "grows", which would come out larger.
    const convert: ImageConverter = async (d) => {
      seen.push(d.length === big.length ? 'big' : d.toString())
      return d.toString() === 'grows' ? Buffer.alloc(100) : Buffer.from('webp')
    }
    const warnings: string[] = []
    const [caro] = await fetchProjectReadmes(PROFILE, 'README.md', fakeFetch(repos), (m) => warnings.push(m), convert)
    expect(caro.images.map((i) => [i.path, i.data.toString()])).toEqual([
      ['a.png.webp', 'webp'], // over the budget as a PNG, fits as WebP
      ['b.JPG.webp', 'webp'],
      ['c.gif', 'gif'],
      ['d.webp', 'webp'],
      ['e.png', 'grows'], // WebP larger than the original: original kept
    ])
    expect(seen).toEqual(expect.arrayContaining(['big', 'grows', 'jpeg-bytes']))
    expect(seen).not.toContain('gif')
    expect(warnings).toEqual([])
  })

  it('falls back to the original bytes with a warning when the converter throws', async () => {
    const convert: ImageConverter = async () => {
      throw new Error('Input buffer contains unsupported image format')
    }
    const warnings: string[] = []
    const [caro] = await fetchProjectReadmes(PROFILE, 'README.md', fakeFetch(REPOS), (m) => warnings.push(m), convert)
    expect(caro.images.map((i) => [i.path, i.data.toString()])).toEqual([['public/preview_images/Preview_1.png', 'png-1']])
    expect(warnings).toContain(
      'Warning: project caro-app: could not convert README image public/preview_images/Preview_1.png to WebP, keeping the original: Input buffer contains unsupported image format',
    )
  })

  it('the real sharp converter makes a smaller WebP of a PNG and never enlarges a small image', async () => {
    const sharp = (await import('sharp')).default
    const png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#3366cc' } }).png().toBuffer()
    const out = await convertWithSharp(png)
    const meta = await sharp(out).metadata()
    expect([meta.format, meta.width]).toEqual(['webp', 1600])
    expect(out.length).toBeLessThan(png.length)
    const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#cc3366' } }).png().toBuffer()
    expect((await sharp(await convertWithSharp(small)).metadata()).width).toBe(300)
  })

  it('the Portfolio-projects repo uses the same 5 MB budget as every other repo', () => {
    expect(IMAGE_BUDGET).toBe(5 * 1024 * 1024)
  })

  it('needs nothing when the README has no projects section', async () => {
    expect(await fetchProjectReadmes('# no projects', 'README.md', fakeFetch({}), () => {})).toEqual([])
  })
})

describe('syncContent with project READMEs', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })))
  })
  const tempDir = async () => {
    const d = await mkdtemp(join(tmpdir(), 'sync-readmes-'))
    temps.push(d)
    return d
  }
  const put = (root: string, rel: string, data: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), data)
  }

  it('stages the READMEs, their images and the manifest', async () => {
    const profile = await tempDir()
    const out = await tempDir()
    put(profile, 'README.md', PROFILE)
    put(profile, 'READMEVN.md', '# Hồ sơ\n')
    put(profile, '.gitignore', '/x\n')
    const result = await syncContent({ source: 'local', profilePath: profile, outDir: out, fetchImpl: fakeFetch(REPOS), warn: () => {} })
    expect(result.projectReadmes).toEqual([
      { slug: 'caro-app', images: 1, vi: false },
      { slug: 'qanda', images: 1, vi: false },
      { slug: 'bi', images: 3, vi: false },
    ])
    expect(readFileSync(join(out, 'content/project-readmes/qanda.md'), 'utf8')).toBe(QANDA)
    expect(readFileSync(join(out, 'public/content/project-readmes/qanda/1. Qanda App/Preview_0.png'), 'utf8')).toBe('png-0')
    expect(readFileSync(join(out, 'public/content/project-readmes/caro-app/public/preview_images/Preview_1.png'), 'utf8')).toBe('png-1')
    expect(
      readFileSync(join(out, 'public/content/project-readmes/bi/4. Supply chain & Sales/4. Supply chain & Sales Dashboard.png'), 'utf8'),
    ).toBe('supply')
    expect(JSON.parse(readFileSync(join(out, 'content/project-readmes.json'), 'utf8'))).toEqual({
      'caro-app': { repoUrl: 'https://github.com/o/Caro-app', images: ['public/preview_images/Preview_1.png'] },
      qanda: { repoUrl: 'https://github.com/o/Previews/tree/main/1.%20Qanda%20App', images: ['1. Qanda App/Preview_0.png'] },
      bi: {
        repoUrl: 'https://github.com/o/BI-projects',
        images: [
          '2. Excel - Addidas Sales/2. Excel - Adidas Sales Dashboard.png',
          '4. Supply chain & Sales/4. Supply chain & Sales Dashboard.png',
          '1. Preview Atino Data model.png',
        ],
      },
    })
  })

  it('a README that cannot be fetched fails the sync and leaves the previous content untouched', async () => {
    const profile = await tempDir()
    const out = await tempDir()
    put(profile, 'README.md', PROFILE)
    put(profile, 'READMEVN.md', '# Hồ sơ\n')
    put(profile, '.gitignore', '/x\n')
    put(out, 'content/README.md', 'previous')
    const repos = { ...REPOS, 'o/Caro-app/main/': {} }
    await expect(
      syncContent({ source: 'local', profilePath: profile, outDir: out, fetchImpl: fakeFetch(repos), warn: () => {} }),
    ).rejects.toThrow(/README of project caro-app/)
    expect(readFileSync(join(out, 'content/README.md'), 'utf8')).toBe('previous')
    expect(readdirSync(out).filter((n) => n.startsWith('.sync'))).toEqual([])
  })
})

describe('Vietnamese READMEs (READMEVN.md next to README.md)', () => {
  const QANDA_VI = `# Qanda

> 🇬🇧 English version: [README.md](README.md)

![Xem trước 0](Preview_0.png)

![Chỉ VI](Preview_vi.png)
`
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })))
  })
  const tempDir = async () => {
    const d = await mkdtemp(join(tmpdir(), 'sync-readmes-vi-'))
    temps.push(d)
    return d
  }
  const put = (root: string, rel: string, data: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), data)
  }
  const withVi: Repos = {
    ...REPOS,
    'o/Previews/main/': { ...REPOS['o/Previews/main/'], '1. Qanda App/READMEVN.md': QANDA_VI, '1. Qanda App/Preview_vi.png': 'png-vi' },
  }

  it('fetches READMEVN.md from the README folder; a missing one (404) is silent; shared images download once', async () => {
    const calls: Calls = []
    const warnings: string[] = []
    const got = await fetchProjectReadmes(PROFILE, 'README.md', fakeFetch(withVi, { calls }), (m) => warnings.push(m), keep)
    const [caro, qanda, bi] = got
    expect(qanda.markdownVi?.toString()).toBe(QANDA_VI)
    expect(calls).toContain(`${RAW}o/Previews/main/1.%20Qanda%20App/READMEVN.md`)
    expect(qanda.images.map((i) => i.path)).toEqual(['1. Qanda App/Preview_0.png', '1. Qanda App/Preview_vi.png'])
    expect(calls.filter((u) => u === `${RAW}o/Previews/main/1.%20Qanda%20App/Preview_0.png`)).toHaveLength(1)
    // No READMEVN.md in these repos: English only, and no warning about it.
    expect(caro.markdownVi).toBeUndefined()
    expect(bi.markdownVi).toBeUndefined()
    expect(calls).toContain(`${RAW}o/BI-projects/main/READMEVN.md`)
    expect(warnings.some((w) => w.includes('Vietnamese'))).toBe(false)
  })

  it('a READMEVN.md that fails for another reason than 404 warns and falls back to English; the sync goes on', async () => {
    const base = fakeFetch(withVi)
    const flaky = (async (input: string | URL | Request) =>
      String(input).includes('READMEVN.md') ? new Response('busy', { status: 503 }) : base(input)) as typeof fetch
    const warnings: string[] = []
    const [, qanda] = await fetchProjectReadmes(PROFILE, 'README.md', flaky, (m) => warnings.push(m), keep)
    expect(qanda.markdownVi).toBeUndefined()
    expect(qanda.markdown.toString()).toBe(QANDA)
    expect(warnings.filter((w) => w.includes('no Vietnamese README'))).toHaveLength(3)
    expect(warnings.find((w) => w.includes('project qanda'))).toMatch(/HTTP 503/)
  })

  it('stages <slug>.vi.md and marks the manifest entry vi: true (others have no vi key)', async () => {
    const profile = await tempDir()
    const out = await tempDir()
    put(profile, 'README.md', PROFILE)
    put(profile, 'READMEVN.md', '# Hồ sơ\n')
    put(profile, '.gitignore', '/x\n')
    const result = await syncContent({ source: 'local', profilePath: profile, outDir: out, fetchImpl: fakeFetch(withVi), warn: () => {} })
    expect(result.projectReadmes.find((p) => p.slug === 'qanda')).toEqual({ slug: 'qanda', images: 2, vi: true })
    expect(readFileSync(join(out, 'content/project-readmes/qanda.vi.md'), 'utf8')).toBe(QANDA_VI)
    expect(readFileSync(join(out, 'content/project-readmes/qanda.md'), 'utf8')).toBe(QANDA)
    expect(readdirSync(join(out, 'content/project-readmes')).sort()).toEqual(['bi.md', 'caro-app.md', 'qanda.md', 'qanda.vi.md'])
    const manifest = JSON.parse(readFileSync(join(out, 'content/project-readmes.json'), 'utf8'))
    expect(manifest.qanda).toEqual({
      repoUrl: 'https://github.com/o/Previews/tree/main/1.%20Qanda%20App',
      images: ['1. Qanda App/Preview_0.png', '1. Qanda App/Preview_vi.png'],
      vi: true,
    })
    expect(manifest['caro-app']).not.toHaveProperty('vi')
  })
})
