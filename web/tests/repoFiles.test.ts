import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { REPO_FILES, repoFileBySlug, SYNCED_GITIGNORE, SYNCED_REPO_FILES } from '@/lib/repoFiles'
import { READER_SLUGS, readRepoFile } from '@/lib/repoFileText'

describe('repo file allow-list', () => {
  it('is exactly the five config files, in explorer order', () => {
    expect(REPO_FILES.map((f) => [f.slug, f.name, f.syntax, f.path])).toEqual([
      ['gitignore', '.gitignore', 'ignore', 'content/repo-files/gitignore'],
      ['vercelignore', '.vercelignore', 'ignore', '.vercelignore'],
      ['next.config.ts', 'next.config.ts', 'ts', 'next.config.ts'],
      ['package.json', 'package.json', 'json', 'package.json'],
      ['tsconfig.json', 'tsconfig.json', 'json', 'tsconfig.json'],
    ])
  })

  it('never names an env file, a path outside web/ or a URL-unsafe slug', () => {
    for (const f of REPO_FILES) {
      expect(f.path).not.toMatch(/(^|\/)\.env/)
      expect(f.path).not.toMatch(/^\/|^[a-z]:|\.\./i)
      expect(f.slug).toMatch(/^[a-z][a-z0-9.-]*$/)
    }
  })

  it('looks up only allow-listed slugs', () => {
    expect(repoFileBySlug('package.json')?.name).toBe('package.json')
    for (const bad of ['.env', 'env', '.env.local', '.gitignore', '../package.json', 'package.json/', 'README.md', '']) {
      expect(repoFileBySlug(bad)).toBeUndefined()
    }
  })

  it('has one reader per allow-listed file and no other', () => {
    expect([...READER_SLUGS].sort()).toEqual(REPO_FILES.map((f) => f.slug).sort())
  })

  it('syncs only the root .gitignore, to the path the gitignore entry reads', () => {
    expect(SYNCED_REPO_FILES).toEqual([['.gitignore', SYNCED_GITIGNORE]])
    expect(repoFileBySlug('gitignore')?.path).toBe(`content/${SYNCED_GITIGNORE}`)
  })
})

describe('readRepoFile (from web/)', () => {
  it('reads each website file from its path, with LF line endings', () => {
    for (const slug of ['vercelignore', 'next.config.ts', 'package.json', 'tsconfig.json']) {
      const file = repoFileBySlug(slug)!
      const text = readRepoFile(file)
      expect(text).toBe(readFileSync(join(process.cwd(), file.path), 'utf8').replace(/\r\n?/g, '\n'))
      expect(text).not.toContain('\r')
    }
  })

  describe('without a synced .gitignore', () => {
    const cwd = process.cwd()
    beforeEach(() => process.chdir(join(cwd, 'tests')))
    afterEach(() => process.chdir(cwd))

    it('fails naming the file and the sync', () => {
      expect(() => readRepoFile(repoFileBySlug('gitignore')!)).toThrow(/\.gitignore.*content\/repo-files\/gitignore.*npm run sync/)
    })
  })
})
