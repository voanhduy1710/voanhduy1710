import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cachedBySyncedFiles } from '@/lib/syncedCache'

/**
 * Regression for "BI / atino-workspace images missing on the dev server": the loaders cached the synced manifest for
 * the whole process, so after `npm run sync` (BI added, PNGs renamed to `.png.webp`) a running `next dev` kept serving
 * the old manifest: no BI README and `<img src=".../Preview_0.png">` 404s.
 */

let dir: string
const previous = process.env.CONTENT_DIR

/** Writes a file and moves its mtime forward, as a later sync would (same-millisecond writes are not a concern). */
function rewrite(path: string, text: string, secondsLater: number) {
  writeFileSync(path, text)
  const t = new Date(Date.now() + secondsLater * 1000)
  utimesSync(path, t, t)
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'synced-'))
  process.env.CONTENT_DIR = dir
  vi.resetModules()
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  if (previous === undefined) delete process.env.CONTENT_DIR
  else process.env.CONTENT_DIR = previous
})

describe('cachedBySyncedFiles', () => {
  it('loads once while the files are unchanged and again after each rewrite', () => {
    const file = join(dir, 'a.json')
    rewrite(file, '1', 0)
    const load = vi.fn(() => ({ n: load.mock.calls.length }))
    const get = cachedBySyncedFiles(() => [file], load)
    const first = get()
    expect(get()).toBe(first)
    expect(load).toHaveBeenCalledTimes(1)
    rewrite(file, '22', 10)
    const second = get()
    expect(second).not.toBe(first)
    expect(get()).toBe(second)
    rewrite(file, '333', 20)
    expect(get()).not.toBe(second)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('keeps the last value while a file is missing (mid-swap), and loads once it is back', () => {
    const file = join(dir, 'a.json')
    rewrite(file, '1', 0)
    const load = vi.fn(() => ({ n: load.mock.calls.length }))
    const get = cachedBySyncedFiles(() => [file], load)
    const first = get()
    rmSync(file)
    expect(get()).toBe(first)
    rewrite(file, '22', 10)
    expect(get()).not.toBe(first)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('reloads when the path list changes and retries after a failed load', () => {
    let paths = [join(dir, 'x')]
    let fail = true
    const load = vi.fn(() => {
      if (fail) throw new Error('no sync yet')
      return paths[0]
    })
    const get = cachedBySyncedFiles(() => paths, load)
    expect(get).toThrow('no sync yet')
    fail = false
    expect(get()).toBe(join(dir, 'x'))
    paths = [join(dir, 'y')]
    expect(get()).toBe(join(dir, 'y'))
  })
})

describe('project README manifest in a long-running process', () => {
  it('sees a re-sync: a new project and the .png -> .png.webp rename, without a module reload', async () => {
    const manifest = join(dir, 'project-readmes.json')
    mkdirSync(join(dir, 'project-readmes'))
    writeFileSync(join(dir, 'project-readmes', 'atino-workspace.md'), '![Preview 0](Preview_0.png)\n')
    writeFileSync(join(dir, 'project-readmes', 'data-analyst-portfolio.md'), '# Portfolio Projects\n')
    const before = { 'atino-workspace': { repoUrl: 'https://github.com/o/r/tree/main/4.%20W', images: ['4. W/Preview_0.png'] } }
    rewrite(manifest, JSON.stringify(before), 0)

    const { loadProjectReadme, readmeCoverUrl } = await import('@/lib/projectReadmeManifest')
    expect(loadProjectReadme('atino-workspace')?.images).toEqual(['4. W/Preview_0.png'])
    expect(loadProjectReadme('data-analyst-portfolio')).toBeUndefined()

    rewrite(
      manifest,
      JSON.stringify({
        'atino-workspace': { ...before['atino-workspace'], images: ['4. W/Preview_0.png.webp'] },
        'data-analyst-portfolio': {
          repoUrl: 'https://github.com/voanhduy1710/Portfolio-projects',
          images: ['4. Supply chain & Sales/4. Supply chain & Sales Dashboard.png.webp', '5. SQL_preview.png.webp'],
        },
      }),
      30,
    )
    expect(loadProjectReadme('atino-workspace')?.images).toEqual(['4. W/Preview_0.png.webp'])
    expect(loadProjectReadme('data-analyst-portfolio')?.markdown).toBe('# Portfolio Projects\n')
    // The home card's thumbnail: the README's first image, served name, each segment encoded (`&` -> %26).
    expect(readmeCoverUrl('data-analyst-portfolio')).toBe(
      '/content/project-readmes/data-analyst-portfolio/4.%20Supply%20chain%20%26%20Sales/4.%20Supply%20chain%20%26%20Sales%20Dashboard.png.webp',
    )
    expect(readmeCoverUrl('nope')).toBeUndefined()
  })

  it('re-reads the profile READMEs and the certificate manifest after a re-sync', async () => {
    const fixtures = join(process.cwd(), 'tests', 'fixtures')
    const { readFileSync } = await import('node:fs')
    for (const f of ['README.md', 'READMEVN.md']) rewrite(join(dir, f), readFileSync(join(fixtures, f), 'utf8'), 0)
    rewrite(join(dir, 'certificates.json'), '[1]', 0)
    const { loadContent } = await import('@/lib/content')
    const { loadCertificateNumbers } = await import('@/lib/certificateManifest')
    const name = loadContent('en').header.name
    expect([...loadCertificateNumbers()]).toEqual([1])

    const en = readFileSync(join(fixtures, 'README.md'), 'utf8')
    const vi2 = readFileSync(join(fixtures, 'READMEVN.md'), 'utf8')
    rewrite(join(dir, 'README.md'), en.replace(name, `${name} Renamed`), 30)
    rewrite(join(dir, 'READMEVN.md'), vi2, 30)
    rewrite(join(dir, 'certificates.json'), '[1,2]', 30)
    expect(loadContent('en').header.name).toBe(`${name} Renamed`)
    expect([...loadCertificateNumbers()]).toEqual([1, 2])
  }, 60_000)
})
