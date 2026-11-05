import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Element, Root } from 'hast'
import { toHtml } from 'hast-util-to-html'
import { describe, expect, it } from 'vitest'
import { PROFILE_REPO_URL, profileReadmeImageUrl, profileReadmeLinkTarget } from '../../src/lib/profileReadme'
import { renderReadmeTree } from '../../src/lib/projectReadme/render'
import { readmeSource } from '../../src/lib/projectReadme/source'

const SOURCE = readmeSource(PROFILE_REPO_URL)
const tree = (md: string): Root =>
  renderReadmeTree(md, { slug: 'voanhduy1710', source: SOURCE, images: new Set(), imageUrl: profileReadmeImageUrl, linkTarget: profileReadmeLinkTarget })
const render = (md: string) => toHtml(tree(md))
const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8')

function all(node: Root | Element, tag: string): Element[] {
  return node.children.flatMap((c) => (c.type === 'element' ? [...(c.tagName === tag ? [c] : []), ...all(c, tag)] : []))
}

describe('profile README paths', () => {
  it('serves web/public/X from the site root /X (encoded), other images from the synced /content copy', () => {
    expect(profileReadmeImageUrl('web/public/logos/Docker.png')).toBe('/logos/Docker.png')
    expect(profileReadmeImageUrl('web/public/logos/Google Cloud Run.png')).toBe('/logos/Google%20Cloud%20Run.png')
    expect(profileReadmeImageUrl('web/public/previews/Other-private-repo-previews/1. QandaStudy-booking-webapp/Preview_0.png')).toBe(
      '/previews/Other-private-repo-previews/1.%20QandaStudy-booking-webapp/Preview_0.png',
    )
    expect(profileReadmeImageUrl('docs/notes.md')).toBeUndefined()
  })

  it('links the CV PDFs to the synced copy, README <-> READMEVN to the previews, anything else to nothing', () => {
    expect(profileReadmeLinkTarget('CV_Vo Anh Duy_EN.pdf')).toBe('/content/CV_Vo%20Anh%20Duy_EN.pdf')
    expect(profileReadmeLinkTarget('README.md')).toBe('/en/readme')
    expect(profileReadmeLinkTarget('READMEVN.md')).toBe('/vi/readme')
    expect(profileReadmeLinkTarget('web/src/app/page.tsx')).toBeNull()
  })
})

describe('profile README rendering', () => {
  it('rewrites the logo strip to /logos/..., lazy, keeping height and align', () => {
    const html = render('<p align="left">\n  <img src="web/public/logos/Google Cloud Run.png" alt="Google Cloud Run" height="40"/>\n</p>')
    expect(html).toContain('<p align="left">')
    expect(html).toMatch(/<img src="\/logos\/Google%20Cloud%20Run\.png"[^>]*height="40"[^>]*loading="lazy"/)
    expect(html).not.toContain('web/public')
    // GitHub honours height="40"; the site's base CSS would not, so it becomes a generated inline height.
    expect(html).toContain('style="height:40px"')
    expect(render('<img src="web/public/logos/Docker.png" height="40px;background:url(x)">')).not.toContain('style=')
  })

  it('hides the section / project / site markers (HTML comments)', () => {
    const html = render('<!-- section: header -->\n# Hi\n<!-- site: status = Open to work -->\n<!-- project: caro-app -->\n<!-- /section -->')
    expect(html).not.toMatch(/section:|project:|site:|<!--/)
    expect(html).toContain('Hi')
  })

  it('keeps the README raw HTML safe: no scripts, styles, event handlers or javascript: links', () => {
    const html = render(
      [
        '<h1 align="center" onclick="alert(1)" style="color:red">X</h1>',
        '<script>alert(1)</script>',
        '<style>body{display:none}</style>',
        '<img src="web/public/logos/Docker.png" onerror="alert(1)">',
        '<a href="javascript:alert(1)">bad</a>',
        '<iframe src="https://evil.test"></iframe>',
        '<details><summary>More</summary>Body</details>',
      ].join('\n\n'),
    )
    expect(html).not.toMatch(/<script|<style|<iframe|onclick|onerror|style=|javascript:/i)
    expect(html).toContain('<h1 align="center"')
    expect(html).toContain('<details><summary>More</summary>')
  })

  it('renders the real README: logos from /logos, tables, shields badges as chips, no repo paths left', () => {
    for (const name of ['README.md', 'READMEVN.md']) {
      const t = tree(fixture(name))
      const imgs = all(t, 'img').map((i) => String(i.properties.src))
      expect(imgs.length).toBeGreaterThan(10)
      expect(imgs.every((s) => s.startsWith('/logos/') || s.startsWith('/previews/'))).toBe(true)
      expect(all(t, 'img').every((i) => i.properties.loading === 'lazy')).toBe(true)
      expect(all(t, 'table').length).toBeGreaterThanOrEqual(2)
      expect(all(t, 'badge-chip').length).toBeGreaterThan(10)
      const hrefs = all(t, 'a').flatMap((a) => (typeof a.properties.href === 'string' ? [a.properties.href] : []))
      expect(hrefs).toContain('/content/CV_Vo%20Anh%20Duy_EN.pdf')
      expect(hrefs.every((h) => /^(https?:|mailto:|#|\/)/.test(h))).toBe(true)
      expect(toHtml(t)).not.toMatch(/<!--|web\/public/)
    }
  })
})
