import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CERTIFICATES_LIST_URL } from '../../scripts/sync-certificates'
import { syncContent } from '../../scripts/sync-content'
import { analysisFilePaths, fetchProjectReadmes, LINKED_FILE_MAX_BYTES, type ImageConverter } from '../../scripts/sync-project-readmes'
import { readmeSource } from '../../src/lib/projectReadme/source'

const PROFILE = `# Profile

<!-- section: projects -->
## Projects

### Full-Stack Applications & Production Systems

<!-- project: caro-app -->
#### [Caro Web App](https://github.com/o/Caro-app)

### Data Analytics & Business Intelligence

<!-- project: bi -->
#### [BI](https://github.com/o/BI-projects)
<!-- /section -->
`

/** A My works README that happens to have numbered steps linking to a doc: never downloaded (not analytics). */
const CARO = `# Caro

## Setup

### 1. Install

See [the guide](docs/guide.md).
`

const BI = `# BI

Intro links [a note](intro.md) (outside the analyses: not downloaded).

## Projects Overview

### 1. SQL interview questions

Full details: [sub-folder README](5.%20Report/README.md) (a README: never downloaded).

Questions and solutions: [6. SQL_questions.md](6.%20SQL_questions.md), again [here](6.%20SQL_questions.md#q1)

### 2. Apps Script

Script: [7. Script.gs](7.%20Script.gs). Not allow-listed: [data](data.csv), [notes](notes.txt), [folder](3.%20Uber%20Trips),
[readme](README.md), [escape](../other/x.md), [gone](missing.sql), [big](big.md).

## Contact
`
const BI_VI = BI.replace('## Projects Overview', '## Tổng quan dự án').replace('[7. Script.gs]', '[7. Script.gs (VI)]')

const RAW = 'https://raw.githubusercontent.com/'
const REPOS: Record<string, Record<string, string>> = {
  'o/Caro-app/main/': { 'README.md': CARO, 'docs/guide.md': '# Guide' },
  'o/BI-projects/main/': {
    'README.md': BI,
    'READMEVN.md': BI_VI,
    'intro.md': 'intro',
    '5. Report/README.md': '# Report',
    '6. SQL_questions.md': '## Q1\n\n<table><tr><td>x</td></tr></table>\n',
    '7. Script.gs': 'function run() {}\n',
    'data.csv': 'a,b',
    'notes.txt': 'n',
    'big.md': 'x'.repeat(LINKED_FILE_MAX_BYTES + 1),
  },
}

function fakeFetch(calls: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    if (url === CERTIFICATES_LIST_URL) return new Response('[]', { status: 200 })
    if (!url.startsWith(RAW)) return new Response('404', { status: 404 })
    const rest = url.slice(RAW.length)
    const key = Object.keys(REPOS).find((k) => rest.startsWith(k))
    const body = key ? REPOS[key][decodeURIComponent(rest.slice(key.length))] : undefined
    return body === undefined ? new Response('404: Not Found', { status: 404 }) : new Response(body, { status: 200 })
  }) as typeof fetch
}
const keep: ImageConverter = async (d) => d

describe('analysisFilePaths (the allow-list)', () => {
  it('keeps only allow-listed text files linked from the analysis sections, inside the repo, each once', () => {
    const src = readmeSource('https://github.com/o/BI-projects')
    expect(analysisFilePaths([BI, BI_VI], src)).toEqual(['6. SQL_questions.md', '7. Script.gs', 'missing.sql', 'big.md'])
  })

  it('a README without numbered analyses links to nothing the sync downloads', () => {
    expect(analysisFilePaths(['# X\n\n[a](a.md)\n'], readmeSource('https://github.com/o/r'))).toEqual([])
  })
})

describe('fetchProjectReadmes: linked files', () => {
  it('downloads the analytics project\'s allow-listed files only; missing / too large ones are warnings', async () => {
    const calls: string[] = []
    const warnings: string[] = []
    const [caro, bi] = await fetchProjectReadmes(PROFILE, 'README.md', fakeFetch(calls), (m) => warnings.push(m), keep)
    expect(caro.files).toEqual([])
    expect(bi.files.map((f) => [f.path, f.data.toString()])).toEqual([
      ['6. SQL_questions.md', '## Q1\n\n<table><tr><td>x</td></tr></table>\n'],
      ['7. Script.gs', 'function run() {}\n'],
    ])
    expect(warnings.some((w) => w.includes('missing.sql') && w.includes('cannot fetch'))).toBe(true)
    expect(warnings.some((w) => w.includes('big.md') && w.includes('larger than'))).toBe(true)
    // Nothing outside the allow-list is ever requested.
    for (const f of ['docs/guide.md', 'intro.md', 'data.csv', 'notes.txt', 'other/x.md', '5. Report/README.md']) {
      expect(calls.some((u) => decodeURIComponent(u).endsWith(`/${f}`))).toBe(false)
    }
  })
})

describe('syncContent: linked files', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })))
  })
  const put = (root: string, rel: string, data: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), data)
  }

  /** A local profile repo and an output folder (both removed after the test). */
  async function setup() {
    const profile = await mkdtemp(join(tmpdir(), 'sync-linked-'))
    const out = await mkdtemp(join(tmpdir(), 'sync-linked-out-'))
    temps.push(profile, out)
    put(profile, 'README.md', PROFILE)
    put(profile, 'READMEVN.md', '# Hồ sơ\n')
    put(profile, '.gitignore', '/x\n')
    return { profile, out }
  }
  const manifestOf = (out: string) => JSON.parse(readFileSync(join(out, 'content/project-readmes.json'), 'utf8'))

  it('stages them under content/project-readmes/<slug>/ and lists them in the manifest', async () => {
    const { profile, out } = await setup()
    await syncContent({ source: 'local', profilePath: profile, outDir: out, fetchImpl: fakeFetch(), warn: () => {} })
    expect(readFileSync(join(out, 'content/project-readmes/bi/7. Script.gs'), 'utf8')).toBe('function run() {}\n')
    const manifest = manifestOf(out)
    expect(manifest.bi.files).toEqual(['6. SQL_questions.md', '7. Script.gs'])
    expect(manifest['caro-app'].files).toBeUndefined()
  })

  it('a file renamed upstream (6. -> 7.) leaves no stale copy or manifest entry after the next sync', async () => {
    const { profile, out } = await setup()
    const repo = REPOS['o/BI-projects/main/']
    const saved = { ...repo }
    try {
      // Before the rename: the README links `6. Script.gs`.
      repo['README.md'] = BI.replaceAll('7. Script.gs', '6. Script.gs').replaceAll('7.%20Script.gs', '6.%20Script.gs')
      repo['READMEVN.md'] = repo['README.md'].replace('## Projects Overview', '## Tổng quan dự án')
      repo['6. Script.gs'] = 'function old() {}\n'
      await syncContent({ source: 'local', profilePath: profile, outDir: out, fetchImpl: fakeFetch(), warn: () => {} })
      expect(manifestOf(out).bi.files).toEqual(['6. SQL_questions.md', '6. Script.gs'])
    } finally {
      for (const k of Object.keys(repo)) delete repo[k]
      Object.assign(repo, saved)
    }
    await syncContent({ source: 'local', profilePath: profile, outDir: out, fetchImpl: fakeFetch(), warn: () => {} })
    expect(manifestOf(out).bi.files).toEqual(['6. SQL_questions.md', '7. Script.gs'])
    expect(existsSync(join(out, 'content/project-readmes/bi/6. Script.gs'))).toBe(false)
    expect(existsSync(join(out, 'content/project-readmes/bi/7. Script.gs'))).toBe(true)
  })
})
