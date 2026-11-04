import { describe, expect, it } from 'vitest'
import { blobUrl, rawSources, readmeImageUrl, readmeSource, resolveRepoPath } from '../../src/lib/projectReadme/source'

describe('readmeSource', () => {
  it('reads a repo URL as the root README on main', () => {
    expect(readmeSource('https://github.com/voanhduy1710/Caro-app')).toEqual({
      owner: 'voanhduy1710',
      repo: 'Caro-app',
      ref: 'main',
      dir: '',
      path: 'README.md',
    })
    expect(readmeSource('https://github.com/voanhduy1710/Caro-app/').path).toBe('README.md')
    expect(readmeSource('https://github.com/voanhduy1710/Caro-app.git').repo).toBe('Caro-app')
  })

  it('reads a tree URL as the folder README, decoding spaces and keeping dots', () => {
    const s = readmeSource('https://github.com/voanhduy1710/Other-private-repo-previews/tree/main/1.%20QandaStudy-booking-webapp')
    expect(s).toEqual({
      owner: 'voanhduy1710',
      repo: 'Other-private-repo-previews',
      ref: 'main',
      dir: '1. QandaStudy-booking-webapp',
      path: '1. QandaStudy-booking-webapp/README.md',
    })
    expect(readmeSource('https://github.com/o/r/tree/dev/a/b%20c/').path).toBe('a/b c/README.md')
    expect(readmeSource('https://github.com/o/r/tree/main').dir).toBe('')
  })

  it('rejects other URLs', () => {
    for (const bad of [
      'https://gitlab.com/o/r',
      'https://github.com/o',
      'http://github.com/o/r',
      'https://github.com/o/r/blob/main/README.md',
      'https://github.com/o/r/tree/main/..%2F..',
    ]) {
      expect(() => readmeSource(bad), bad).toThrow()
    }
  })

  it('builds raw, jsDelivr and blob URLs with each path segment encoded', () => {
    const s = readmeSource('https://github.com/o/r/tree/main/1.%20App')
    expect(rawSources(s, '1. App/a #1.png').map((x) => x.url)).toEqual([
      'https://raw.githubusercontent.com/o/r/main/1.%20App/a%20%231.png',
      'https://cdn.jsdelivr.net/gh/o/r@main/1.%20App/a%20%231.png',
    ])
    expect(blobUrl(s, '1. App/docs/setup.md')).toBe('https://github.com/o/r/blob/main/1.%20App/docs/setup.md')
    expect(readmeImageUrl('caro-app', 'public/preview images/P 1.png')).toBe(
      '/content/project-readmes/caro-app/public/preview%20images/P%201.png',
    )
  })
})

describe('resolveRepoPath', () => {
  it('resolves against the README folder, or the repo root for a leading slash', () => {
    expect(resolveRepoPath('', './docs/x.png')).toBe('docs/x.png')
    expect(resolveRepoPath('', 'preview/1.png')).toBe('preview/1.png')
    expect(resolveRepoPath('1. App', 'Preview_0.png')).toBe('1. App/Preview_0.png')
    expect(resolveRepoPath('1. App', 'img/a%20b.png?raw=true#x')).toBe('1. App/img/a b.png')
    expect(resolveRepoPath('1. App', '/logo.png')).toBe('logo.png')
    expect(resolveRepoPath('1. App', '../shared/logo.png')).toBe('shared/logo.png')
  })

  it('rejects paths that escape the repo or are not valid file names', () => {
    expect(resolveRepoPath('', '../x.png')).toBeUndefined()
    expect(resolveRepoPath('1. App', '../../x.png')).toBeUndefined()
    expect(resolveRepoPath('', 'a/../../x.png')).toBeUndefined()
    expect(resolveRepoPath('', '%2E%2E/x.png')).toBeUndefined()
    expect(resolveRepoPath('', 'a\\b.png')).toBeUndefined()
    expect(resolveRepoPath('', 'a:b.png')).toBeUndefined()
    expect(resolveRepoPath('', 'bad%zz.png')).toBeUndefined()
    expect(resolveRepoPath('', '')).toBeUndefined()
    expect(resolveRepoPath('', '.')).toBeUndefined()
  })
})
