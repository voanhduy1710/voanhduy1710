import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CERTIFICATES_LIST_URL, CERTIFICATES_RAW_BASE } from '../../scripts/sync-certificates'
import { GITHUB_RAW_BASE, githubRawBase, syncContent } from '../../scripts/sync-content'

const README = `# Profile

<img src="web/public/logos/Google Cloud Run.png" width="40">
<img src="web/public/logos/Docker.png" width="40">

![Caro](web/public/previews/Caro-app/Preview_1.png)

![Qanda](web/public/previews/Other-private-repo-previews/1.%20QandaStudy-booking-webapp/Preview_0.png)

[Download CV](CV_Vo%20Anh%20Duy_EN.pdf) · [Site](https://example.com/x.png)

<!-- section: certifications -->
| № | Certificate | Status |
|---|---|---|
| 1 | [Alpha](https://example.com/alpha) | Completed |
| 2 | Beta | In progress |
| 3 | Gamma | In progress |
<!-- /section -->
`

const READMEVN = `# Hồ sơ

<img src="web/public/logos/Docker.png" width="40">

![Caro](web/public/previews/Caro-app/Preview_1.png)

[Tải CV](<CV_Vo Anh Duy_VN.pdf>)
`

/** Assets the sync copies into `public/content/`. */
const COPIED = ['CV_Vo Anh Duy_EN.pdf', 'CV_Vo Anh Duy_VN.pdf']
/** Assets already in the website's `public/` folder: only checked, never copied. */
const IN_PUBLIC = [
  'web/public/logos/Google Cloud Run.png',
  'web/public/logos/Docker.png',
  'web/public/previews/Caro-app/Preview_1.png',
  'web/public/previews/Other-private-repo-previews/1. QandaStudy-booking-webapp/Preview_0.png',
]
const ASSETS = [...IN_PUBLIC, ...COPIED]
/** The profile repo's root .gitignore: always copied, to `content/repo-files/gitignore`. */
const GITIGNORE = '# root ignore\n/web/.next/\n'

/** Files of the voanhduy1710/Certifications repo: № 1 (completed) and № 2 (in progress) have a PDF, № 3 has none. */
const CERT_FILES: Record<string, string> = {
  '1. Alpha Cert_Voanhduy1710.pdf': '%PDF- 1',
  '2. Beta_Voanhduy1710.pdf': '%PDF- 2',
  '9. Not in the README.pdf': '%PDF- 9',
  'notes.pdf': 'not numbered',
  'README.md': '# certs',
}
const certListing = (files: Record<string, string>) =>
  JSON.stringify([...Object.keys(files).map((name) => ({ name, type: 'file' })), { name: '4. Folder.pdf', type: 'dir' }])

/**
 * Fake replies of the Certifications repo: the API listing and raw files; undefined for any other URL.
 * `status` overrides the reply for the listing (`list`) or for a file name.
 */
function certReply(url: string, status: Record<string, number> = {}, files = CERT_FILES): Response | undefined {
  if (url === CERTIFICATES_LIST_URL) {
    const code = status.list ?? 200
    return new Response(code === 200 ? certListing(files) : 'rate limited', { status: code })
  }
  if (!url.startsWith(CERTIFICATES_RAW_BASE)) return undefined
  const name = decodeURIComponent(url.slice(CERTIFICATES_RAW_BASE.length))
  const code = status[name] ?? (name in files ? 200 : 404)
  return new Response(code === 200 ? files[name] : 'Not Found', { status: code })
}

/** Local mode still fetches the certificates: every test gets this fake unless it passes its own fetchImpl. */
const certFetchCalls: { url: string; init?: RequestInit }[] = []
beforeEach(() => {
  certFetchCalls.length = 0
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    certFetchCalls.push({ url, init })
    return certReply(url) ?? new Response('unexpected request in a local-mode test', { status: 599 })
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

/** Where the website keeps an in-public asset, relative to outDir: `web/public/x.png` -> `public/x.png`. */
function sitePublic(asset: string): string {
  return asset.slice('web/'.length)
}

const temps: string[] = []
async function tempDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'sync-test-'))
  temps.push(d)
  return d
}
afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })))
})

function put(root: string, rel: string, data: string): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), data)
}

async function profileFixture(skip: string[] = []): Promise<string> {
  const p = await tempDir()
  put(p, 'README.md', README)
  put(p, 'READMEVN.md', READMEVN)
  if (!skip.includes('.gitignore')) put(p, '.gitignore', GITIGNORE)
  for (const a of ASSETS) if (!skip.includes(a)) put(p, a, `bytes of ${a}`)
  return p
}

/** An outDir that already holds the website's own public assets (as the real `web/` does), minus `skip`. */
async function siteFixture(skip: string[] = []): Promise<string> {
  const out = await tempDir()
  for (const a of IN_PUBLIC) if (!skip.includes(a)) put(out, sitePublic(a), `site copy of ${a}`)
  return out
}

/** Fake fetch serving the fixture files by raw URL; `status` overrides the reply for given README-relative paths. */
function fakeFetch(urls: string[], status: Record<string, number> = {}): typeof fetch {
  const files: Record<string, string> = { 'README.md': README, 'READMEVN.md': READMEVN, '.gitignore': GITIGNORE }
  for (const a of ASSETS) files[a] = `bytes of ${a}`
  return (async (input: string | URL | Request) => {
    const url = String(input)
    const cert = certReply(url, status)
    if (cert) return cert
    urls.push(url)
    const rel = decodeURI(url.replace(/^https:\/\/raw\.githubusercontent\.com\/voanhduy1710\/voanhduy1710\/[^/]+\//, ''))
    const code = status[rel] ?? (rel in files ? 200 : 404)
    return new Response(code === 200 ? files[rel] : 'Not Found', { status: code })
  }) as typeof fetch
}

function listTree(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listTree(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  )
}

describe('syncContent', () => {
  it('local: copies READMEs and the CV PDFs; web/public assets are checked, not copied', async () => {
    const profilePath = await profileFixture()
    const out = await tempDir()
    const { files } = await syncContent({ source: 'local', profilePath, outDir: out })

    expect(readFileSync(join(out, 'content/README.md'), 'utf8')).toBe(README)
    expect(readFileSync(join(out, 'content/READMEVN.md'), 'utf8')).toBe(READMEVN)
    for (const a of COPIED) {
      expect(readFileSync(join(out, 'public/content', a), 'utf8')).toBe(`bytes of ${a}`)
    }
    expect(readFileSync(join(out, 'content/repo-files/gitignore'), 'utf8')).toBe(GITIGNORE)
    expect(files.sort()).toEqual(['README.md', 'READMEVN.md', '.gitignore', ...COPIED].sort())
    expect(listTree(join(out, 'content')).sort()).toEqual(['README.md', 'READMEVN.md', 'certificates.json', 'project-readmes.json', 'repo-files/gitignore'])
    // nothing else is written: no web/public asset, no absolute-URL "asset", no staging leftovers
    expect(listTree(join(out, 'public')).sort()).toEqual(
      [...COPIED.map((a) => `content/${a}`), 'content/certificates/1.pdf', 'content/certificates/2.pdf'].sort(),
    )
    expect(readdirSync(out).sort()).toEqual(['content', 'public'])
  })

  it('a failing staging cleanup (EBUSY on Windows) only warns; the sync still succeeds', async () => {
    const profilePath = await profileFixture()
    const out = await tempDir()
    const calls: unknown[][] = []
    const rmImpl = (async (...args: unknown[]) => {
      calls.push(args)
      throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
    }) as unknown as typeof rm
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { files } = await syncContent({ source: 'local', profilePath, outDir: out, rmImpl })
      expect(files).toContain('README.md')
      expect(readFileSync(join(out, 'content/README.md'), 'utf8')).toBe(README)
      expect(calls).toHaveLength(1)
      expect(calls[0][1]).toMatchObject({ recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not remove staging folder'))
    } finally {
      warn.mockRestore()
    }
  })

  it('a folder Windows keeps locked (EPERM, e.g. a running dev server) is retried, then updated in place with a warning', async () => {
    const profilePath = await profileFixture()
    const out = await tempDir()
    put(out, 'public/content/stale.pdf', 'old')
    put(out, 'content/README.md', 'old')
    let calls = 0
    // Every rename of the live public/content folder is refused, like a folder held by `next dev`.
    const renameImpl = (async (from: string, to: string) => {
      calls++
      if (String(from).endsWith(join('public', 'content'))) {
        throw Object.assign(new Error(`EPERM: operation not permitted, rename '${from}'`), { code: 'EPERM' })
      }
      return rename(from, to)
    }) as typeof rename
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await syncContent({ source: 'local', profilePath, outDir: out, fsHooks: { renameImpl, retryDelayMs: () => 0 } })
      expect(readFileSync(join(out, 'content/README.md'), 'utf8')).toBe(README)
      expect(listTree(join(out, 'public/content')).sort()).toEqual(
        [...COPIED, 'certificates/1.pdf', 'certificates/2.pdf'].sort(),
      )
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('updated them in place instead'))
      expect(calls).toBeGreaterThanOrEqual(5)
      expect(readdirSync(out).sort()).toEqual(['content', 'public'])
    } finally {
      warn.mockRestore()
    }
  })

  it('a rename that fails transiently (EBUSY twice) still swaps atomically, without a warning', async () => {
    const profilePath = await profileFixture()
    const out = await tempDir()
    put(out, 'public/content/stale.pdf', 'old')
    let failures = 2
    const renameImpl = (async (from: string, to: string) => {
      if (failures > 0) {
        failures--
        throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      }
      return rename(from, to)
    }) as typeof rename
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await syncContent({ source: 'local', profilePath, outDir: out, fsHooks: { renameImpl, retryDelayMs: () => 0 } })
      expect(listTree(join(out, 'public/content'))).not.toContain('stale.pdf')
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('a second sync into the same folder waits for the lock; a held lock times out with a clear message', async () => {
    const profilePath = await profileFixture()
    const out = await tempDir()
    await Promise.all([
      syncContent({ source: 'local', profilePath, outDir: out }),
      syncContent({ source: 'local', profilePath, outDir: out }),
    ])
    expect(readFileSync(join(out, 'content/README.md'), 'utf8')).toBe(README)
    put(out, '.sync-lock', JSON.stringify({ pid: process.pid }))
    await expect(syncContent({ source: 'local', profilePath, outDir: out, lockTimeoutMs: 50 })).rejects.toThrow(
      /Another content sync is running/,
    )
  })

  it('local: a missing web/public asset rejects naming it, nothing written', async () => {
    const missing = 'web/public/previews/Other-private-repo-previews/1. QandaStudy-booking-webapp/Preview_0.png'
    const profilePath = await profileFixture([missing])
    const out = await tempDir()
    put(out, 'content/README.md', 'old')
    await expect(syncContent({ source: 'local', profilePath, outDir: out })).rejects.toThrow(missing)
    expect(listTree(out)).toEqual(['content/README.md'])
  })

  it('local: replaces previous content, dropping files no longer referenced', async () => {
    const profilePath = await profileFixture()
    const out = await tempDir()
    put(out, 'content/README.md', 'old')
    put(out, 'public/content/logos/Removed.png', 'old')
    put(out, 'public/favicon.ico', 'keep')
    await syncContent({ source: 'local', profilePath, outDir: out })

    expect(readFileSync(join(out, 'content/README.md'), 'utf8')).toBe(README)
    expect(existsSync(join(out, 'public/content/logos/Removed.png'))).toBe(false)
    expect(readFileSync(join(out, 'public/favicon.ico'), 'utf8')).toBe('keep')
  })

  it('github: every request carries a 30 s timeout signal, so a stalled fetch fails instead of hanging', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const inner = fakeFetch([])
    const signals: unknown[] = []
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      signals.push(init?.signal)
      return inner(input, init)
    }) as typeof fetch
    await syncContent({ source: 'github', profilePath: 'unused', outDir: await siteFixture(), fetchImpl })
    expect(signals.length).toBeGreaterThan(5)
    for (const sig of signals) expect(sig).toBeInstanceOf(AbortSignal)
    expect(timeout).toHaveBeenCalledTimes(signals.length)
    for (const [ms] of timeout.mock.calls) expect(ms).toBe(30_000)
    timeout.mockRestore()
  })

  it('github: requests encoded raw URLs for READMEs and PDFs only; web/public assets are checked in outDir/public', async () => {
    const urls: string[] = []
    const out = await siteFixture()
    const { files } = await syncContent({ source: 'github', profilePath: 'unused', outDir: out, fetchImpl: fakeFetch(urls) })

    expect(GITHUB_RAW_BASE).toBe('https://raw.githubusercontent.com/voanhduy1710/voanhduy1710/main/')
    expect(urls.sort()).toEqual(
      [
        `${GITHUB_RAW_BASE}README.md`,
        `${GITHUB_RAW_BASE}READMEVN.md`,
        `${GITHUB_RAW_BASE}.gitignore`,
        'https://raw.githubusercontent.com/voanhduy1710/voanhduy1710/main/CV_Vo%20Anh%20Duy_EN.pdf',
        `${GITHUB_RAW_BASE}CV_Vo%20Anh%20Duy_VN.pdf`,
      ].sort(),
    )
    expect(files.sort()).toEqual(['README.md', 'READMEVN.md', '.gitignore', ...COPIED].sort())
    expect(readFileSync(join(out, 'content/repo-files/gitignore'), 'utf8')).toBe(GITIGNORE)
    expect(readFileSync(join(out, 'public/content/CV_Vo Anh Duy_EN.pdf'), 'utf8')).toBe(
      'bytes of CV_Vo Anh Duy_EN.pdf',
    )
    // the site's own public files are left as they were
    for (const a of IN_PUBLIC) expect(readFileSync(join(out, sitePublic(a)), 'utf8')).toBe(`site copy of ${a}`)
  })

  it('github: CONTENT_REF pins every raw URL to that commit SHA', async () => {
    const urls: string[] = []
    const out = await siteFixture()
    const sha = '4f5b8af0123456789abcdef0123456789abcdef0'
    await syncContent({ source: 'github', profilePath: 'unused', outDir: out, ref: sha, fetchImpl: fakeFetch(urls) })
    const base = `https://raw.githubusercontent.com/voanhduy1710/voanhduy1710/${sha}/`
    expect(githubRawBase(sha)).toBe(base)
    expect(urls.sort()).toEqual(
      ['README.md', 'READMEVN.md', '.gitignore', 'CV_Vo%20Anh%20Duy_EN.pdf', 'CV_Vo%20Anh%20Duy_VN.pdf'].map((f) => base + f).sort(),
    )
  })

  it('github: rejects a CONTENT_REF that is not a plain branch / tag / SHA, before fetching', async () => {
    const urls: string[] = []
    const opts = { source: 'github' as const, profilePath: 'unused', outDir: await tempDir(), fetchImpl: fakeFetch(urls) }
    for (const ref of ['main ', '../evil', 'a?b']) {
      await expect(syncContent({ ...opts, ref })).rejects.toThrow('CONTENT_REF must be a branch, tag or commit SHA')
    }
    expect(urls).toEqual([])
  })

  it('github: a web/public asset missing from outDir/public rejects naming it, previous content untouched', async () => {
    const missing = 'web/public/logos/Google Cloud Run.png'
    const out = await siteFixture([missing])
    put(out, 'content/README.md', 'old')
    const opts = { source: 'github' as const, profilePath: 'unused', outDir: out, fetchImpl: fakeFetch([]) }
    await expect(syncContent(opts)).rejects.toThrow(missing)
    expect(readFileSync(join(out, 'content/README.md'), 'utf8')).toBe('old')
    expect(existsSync(join(out, 'public/content'))).toBe(false)
  })

  it('github: non-200 rejects naming the path and leaves previous content untouched', async () => {
    const out = await siteFixture()
    put(out, 'content/README.md', 'old')
    put(out, 'public/content/CV_Vo Anh Duy_EN.pdf', 'old')
    const opts = {
      source: 'github' as const,
      profilePath: 'unused',
      outDir: out,
      fetchImpl: fakeFetch([], { 'CV_Vo Anh Duy_VN.pdf': 404 }),
    }
    await expect(syncContent(opts)).rejects.toThrow(/404.*CV_Vo Anh Duy_VN\.pdf/)
    expect(readFileSync(join(out, 'content/README.md'), 'utf8')).toBe('old')
    expect(readFileSync(join(out, 'public/content/CV_Vo Anh Duy_EN.pdf'), 'utf8')).toBe('old')
    expect(listTree(join(out, 'public', 'content'))).toEqual(['CV_Vo Anh Duy_EN.pdf'])
    expect(readdirSync(out).sort()).toEqual(['content', 'public'])
  })

  it('github: a network error rejects naming the path', async () => {
    const out = await tempDir()
    const fetchImpl = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    await expect(syncContent({ source: 'github', profilePath: 'unused', outDir: out, fetchImpl })).rejects.toThrow(
      /README\.md.*fetch failed/,
    )
    expect(readdirSync(out)).toEqual([])
  })

  it('local: missing referenced file rejects naming it', async () => {
    const profilePath = await profileFixture(['CV_Vo Anh Duy_EN.pdf'])
    const out = await tempDir()
    put(out, 'content/README.md', 'old')
    await expect(syncContent({ source: 'local', profilePath, outDir: out })).rejects.toThrow(
      /CV_Vo Anh Duy_EN\.pdf/,
    )
    expect(readFileSync(join(out, 'content/README.md'), 'utf8')).toBe('old')
    expect(listTree(out)).toEqual(['content/README.md'])
  })

  it('local: file names must match in letter case, even on a case-insensitive disk', async () => {
    for (const ref of ['web/public/logos/foo.png', 'shots/foo.png', 'Web/public/logos/Foo.png']) {
      const profilePath = await tempDir()
      put(profilePath, 'README.md', `![x](${ref})`)
      put(profilePath, 'READMEVN.md', '')
      put(profilePath, 'web/public/logos/Foo.png', 'png')
      put(profilePath, 'shots/Foo.png', 'png')
      const out = await tempDir()
      await expect(syncContent({ source: 'local', profilePath, outDir: out })).rejects.toThrow(ref)
      expect(readdirSync(out)).toEqual([])
    }
  })

  it('local: the README files themselves must match in letter case', async () => {
    const profilePath = await profileFixture()
    rmSync(join(profilePath, 'READMEVN.md'))
    put(profilePath, 'ReadmeVN.md', READMEVN)
    const out = await tempDir()
    await expect(syncContent({ source: 'local', profilePath, outDir: out })).rejects.toThrow(/READMEVN\.md.*case-sensitive/)
  })

  it('github: a web/public asset whose letter case differs in outDir/public rejects naming it', async () => {
    const out = await siteFixture(['web/public/logos/Docker.png'])
    put(out, 'public/logos/docker.png', 'wrong case')
    const opts = { source: 'github' as const, profilePath: 'unused', outDir: out, fetchImpl: fakeFetch([]) }
    await expect(syncContent(opts)).rejects.toThrow('web/public/logos/Docker.png')
    expect(existsSync(join(out, 'content'))).toBe(false)
  })

  it('local: a missing root .gitignore rejects naming it, previous content untouched', async () => {
    const profilePath = await profileFixture(['.gitignore'])
    const out = await tempDir()
    put(out, 'content/README.md', 'old')
    await expect(syncContent({ source: 'local', profilePath, outDir: out })).rejects.toThrow(/\.gitignore.*case-sensitive/)
    expect(listTree(out)).toEqual(['content/README.md'])
  })

  it('local: the root .gitignore must match in letter case', async () => {
    const profilePath = await profileFixture(['.gitignore'])
    put(profilePath, '.GitIgnore', GITIGNORE)
    const out = await tempDir()
    await expect(syncContent({ source: 'local', profilePath, outDir: out })).rejects.toThrow(/Cannot read \.gitignore/)
    expect(readdirSync(out)).toEqual([])
  })

  it('github: a 404 for the root .gitignore at the pinned ref rejects naming it, previous content untouched', async () => {
    const urls: string[] = []
    const out = await siteFixture()
    put(out, 'content/repo-files/gitignore', 'old')
    const sha = '4f5b8af0123456789abcdef0123456789abcdef0'
    const fetchImpl = fakeFetch(urls, { '.gitignore': 404 })
    await expect(syncContent({ source: 'github', profilePath: 'unused', outDir: out, ref: sha, fetchImpl })).rejects.toThrow(
      /404.*\.gitignore/,
    )
    expect(urls).toContain(`https://raw.githubusercontent.com/voanhduy1710/voanhduy1710/${sha}/.gitignore`)
    expect(readFileSync(join(out, 'content/repo-files/gitignore'), 'utf8')).toBe('old')
  })

  it('certificates: downloads the numbered PDFs of the README certifications as <no>.pdf, plus a manifest', async () => {
    const profilePath = await profileFixture()
    const out = await tempDir()
    const { certificates } = await syncContent({ source: 'local', profilePath, outDir: out })

    expect(certificates).toEqual([1, 2])
    expect(readFileSync(join(out, 'public/content/certificates/1.pdf'), 'utf8')).toBe('%PDF- 1')
    // not completed, but it has a PDF: shown too
    expect(readFileSync(join(out, 'public/content/certificates/2.pdf'), 'utf8')).toBe('%PDF- 2')
    // № 9 is not in the README, notes.pdf has no number, "4. Folder.pdf" is a folder
    expect(listTree(join(out, 'public/content/certificates')).sort()).toEqual(['1.pdf', '2.pdf'])
    expect(JSON.parse(readFileSync(join(out, 'content/certificates.json'), 'utf8'))).toEqual([1, 2])

    const urls = certFetchCalls.map((c) => c.url)
    expect(urls.filter((u) => u === CERTIFICATES_LIST_URL)).toHaveLength(1)
    expect(CERTIFICATES_LIST_URL).toBe('https://api.github.com/repos/voanhduy1710/Certifications/contents/?ref=main')
    expect(urls.filter((u) => u !== CERTIFICATES_LIST_URL).sort()).toEqual([
      'https://raw.githubusercontent.com/voanhduy1710/Certifications/main/1.%20Alpha%20Cert_Voanhduy1710.pdf',
      'https://raw.githubusercontent.com/voanhduy1710/Certifications/main/2.%20Beta_Voanhduy1710.pdf',
    ])
    for (const { init } of certFetchCalls) {
      expect(new Headers(init?.headers).get('User-Agent')).toBe('voanhduy1710-portfolio-sync')
    }
  })

  it('certificates: github mode lists and downloads them the same way', async () => {
    const out = await siteFixture()
    const { certificates } = await syncContent({ source: 'github', profilePath: 'unused', outDir: out, fetchImpl: fakeFetch([]) })
    expect(certificates).toEqual([1, 2])
    expect(readFileSync(join(out, 'public/content/certificates/1.pdf'), 'utf8')).toBe('%PDF- 1')
  })

  it('certificates: a completed certificate without a PDF rejects naming it, previous content untouched', async () => {
    const profilePath = await profileFixture()
    put(profilePath, 'README.md', README.replace('| 3 | Gamma | In progress |', '| 3 | Gamma | Completed |'))
    const out = await tempDir()
    put(out, 'content/README.md', 'old')
    await expect(syncContent({ source: 'local', profilePath, outDir: out })).rejects.toThrow(
      /README\.md lists completed certificates with no .*voanhduy1710\/Certifications: № 3 Gamma/,
    )
    expect(listTree(out)).toEqual(['content/README.md'])
  })

  it('certificates: when every source of the listing or a PDF fails, it rejects naming each attempt, previous content untouched', async () => {
    for (const [status, message] of [
      [{ list: 403 }, /Cannot fetch the file list of voanhduy1710\/Certifications: GitHub returned HTTP 403 .*; jsDelivr returned HTTP 404/],
      [{ '2. Beta_Voanhduy1710.pdf': 404 }, /Cannot fetch voanhduy1710\/Certifications\/2\. Beta_Voanhduy1710\.pdf: GitHub raw returned HTTP 404 .*; jsDelivr returned HTTP 404/],
    ] as const) {
      const out = await siteFixture()
      put(out, 'content/README.md', 'old')
      const opts = { source: 'github' as const, profilePath: 'unused', outDir: out, fetchImpl: fakeFetch([], status) }
      await expect(syncContent(opts)).rejects.toThrow(message)
      expect(readFileSync(join(out, 'content/README.md'), 'utf8')).toBe('old')
      expect(existsSync(join(out, 'public/content'))).toBe(false)
    }
  })

  it('certificates: two PDFs with the same number reject naming both', async () => {
    const profilePath = await profileFixture()
    const out = await tempDir()
    const files = { ...CERT_FILES, '1. Alpha again.pdf': 'dup' }
    const fetchImpl = (async (input: string | URL | Request) => certReply(String(input), {}, files)!) as typeof fetch
    await expect(syncContent({ source: 'local', profilePath, outDir: out, fetchImpl })).rejects.toThrow(
      /two PDFs numbered 1: "1\. Alpha Cert_Voanhduy1710\.pdf" and "1\. Alpha again\.pdf"/,
    )
    expect(readdirSync(out)).toEqual([])
  })

  it('rejects a referenced path that escapes the profile repo', async () => {
    const profilePath = await tempDir()
    put(profilePath, 'README.md', '![x](../secret.png)')
    put(profilePath, 'READMEVN.md', '')
    const out = await tempDir()
    await expect(syncContent({ source: 'local', profilePath, outDir: out })).rejects.toThrow(/\.\.\/secret\.png/)
    expect(readdirSync(out)).toEqual([])
  })
})
