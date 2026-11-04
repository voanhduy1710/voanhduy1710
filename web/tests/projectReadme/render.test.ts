import type { Element, Root } from 'hast'
import { toHtml } from 'hast-util-to-html'
import { describe, expect, it } from 'vitest'
import { badgeFromProps, relativeImagePaths, renderReadmeTree } from '../../src/lib/projectReadme/render'
import { readmeSource } from '../../src/lib/projectReadme/source'

const ROOT = readmeSource('https://github.com/voanhduy1710/Caro-app')
const FOLDER = readmeSource('https://github.com/voanhduy1710/Other-private-repo-previews/tree/main/1.%20QandaStudy-booking-webapp')

function render(md: string, images: string[] = [], source = ROOT): string {
  return toHtml(renderReadmeTree(md, { slug: 'caro-app', source, images: new Set(images) }))
}

function find(tree: Root, tag: string): Element[] {
  const out: Element[] = []
  const walk = (n: Root | Element) => {
    for (const c of n.children) {
      if (c.type !== 'element') continue
      if (c.tagName === tag) out.push(c)
      walk(c)
    }
  }
  walk(tree)
  return out
}

describe('relativeImagePaths', () => {
  it('lists markdown and HTML images resolved against the README folder, skipping absolute ones', () => {
    const md = [
      '![a](Preview_0.png)',
      '<img src="docs/b.png" width="300">',
      '![c](https://example.com/c.png)',
      '![badge](https://img.shields.io/badge/React-19-blue.svg)',
      '![again](./Preview_0.png)',
      '![up](../../escape.png)',
    ].join('\n\n')
    expect(relativeImagePaths(md, FOLDER)).toEqual({
      paths: ['1. QandaStudy-booking-webapp/Preview_0.png', '1. QandaStudy-booking-webapp/docs/b.png'],
      rejected: ['../../escape.png'],
    })
  })
})

describe('renderReadmeTree', () => {
  it('serves a sync-converted image (<path>.webp) with a .webp extension', () => {
    const html = render('![a](shots/a.png) ![g](shots/g.gif)', ['shots/a.png.webp', 'shots/g.gif'])
    expect(html).toContain('src="/content/project-readmes/caro-app/shots/a.png.webp"')
    expect(html).toContain('src="/content/project-readmes/caro-app/shots/g.gif"')
    // an image the sync did not save is still dropped
    expect(render('![a](shots/a.png)', ['other.png.webp'])).not.toContain('<img')
  })

  it('rewrites synced repo-relative images to the served copy and drops the others', () => {
    const html = render('![one](public/preview_images/Preview_1.png)\n\n<img src="missing.png" alt="gone">', [
      'public/preview_images/Preview_1.png',
    ])
    expect(html).toContain('src="/content/project-readmes/caro-app/public/preview_images/Preview_1.png"')
    expect(html).toContain('alt="one"')
    expect(html).not.toContain('missing.png')
    expect(html).not.toContain('gone')
  })

  it('keeps align / width / height on HTML images, paragraphs and cells', () => {
    const html = render('<p align="center"><img src="a.png" width="320" height="200" align="right"></p>\n\n<table><tr><td align="center" width="50%">x</td></tr></table>', ['a.png'])
    expect(html).toMatch(/<p align="center">/)
    expect(html).toMatch(/<img src="[^"]+a\.png" width="320" height="200" align="right"/)
    expect(html).toMatch(/<td align="center" width="50%">/)
  })

  it('turns shields.io badges into badge-chip placeholders (no image request), keeping their link', () => {
    const tree = renderReadmeTree('[![Node.js](https://img.shields.io/badge/Node.js-20.19%2B-green.svg)](https://nodejs.org/)', {
      slug: 'caro-app',
      source: ROOT,
      images: new Set(),
    })
    const html = toHtml(tree)
    expect(html).not.toContain('img.shields.io')
    const [chip] = find(tree, 'badge-chip')
    expect(badgeFromProps(chip.properties)).toEqual({ label: 'Node.js', message: '20.19+', color: '#97ca00' })
    expect(find(tree, 'a')[0].properties.href).toBe('https://nodejs.org/')
  })

  it('reads badge props back from hast properties or React props', () => {
    expect(badgeFromProps({ 'data-label': 'A', 'data-message': 'B', 'data-color': '#fff' })).toEqual({ label: 'A', message: 'B', color: '#fff' })
  })

  it('replaces other absolute images with a link labelled by the alt text (plain text inside a link)', () => {
    const html = render('![Architecture diagram](https://example.com/arch.png)\n\n[![Demo](https://cdn.example.com/demo.gif)](https://demo.example.com)\n\n![](https://x.dev/pic%201.jpg)')
    expect(html).not.toMatch(/<img/)
    expect(html).toContain('<a href="https://example.com/arch.png" target="_blank" rel="noopener noreferrer">Architecture diagram</a>')
    expect(html).toContain('<a href="https://demo.example.com" target="_blank" rel="noopener noreferrer">Demo</a>')
    expect(html).toContain('>pic 1.jpg</a>')
  })

  it('a shields URL it cannot read as a static badge becomes a link too', () => {
    const html = render('![stars](https://img.shields.io/github/stars/o/r)')
    expect(html).toContain('<a href="https://img.shields.io/github/stars/o/r" target="_blank" rel="noopener noreferrer">stars</a>')
    expect(html).not.toMatch(/<img/)
  })

  it('drops <picture> sources so no variant is fetched from elsewhere', () => {
    const html = render('<picture><source media="(prefers-color-scheme: dark)" srcset="https://example.com/dark.png"><img src="a.png" alt="logo"></picture>', ['a.png'])
    expect(html).not.toContain('dark.png')
    expect(html).toContain('/content/project-readmes/caro-app/a.png')
  })

  it('points repo-relative links at GitHub, opens absolute links in a new tab, keeps #anchors', () => {
    const html = render(
      '[setup](docs/setup.md#env) [root](/LICENSE) [site](https://league-of-caro.vercel.app/) [env](#3-configure-environment-variables) [bad](../../x)',
      [],
      FOLDER,
    )
    expect(html).toContain(
      '<a href="https://github.com/voanhduy1710/Other-private-repo-previews/blob/main/1.%20QandaStudy-booking-webapp/docs/setup.md#env" target="_blank" rel="noopener noreferrer">setup</a>',
    )
    expect(html).toContain('href="https://github.com/voanhduy1710/Other-private-repo-previews/blob/main/LICENSE"')
    expect(html).toContain('<a href="https://league-of-caro.vercel.app/" target="_blank" rel="noopener noreferrer">site</a>')
    expect(html).toContain('<a href="#3-configure-environment-variables">env</a>')
    expect(html).toContain('<a>bad</a>')
  })

  it('BI README: links to folders and files with %20 / `&` / .md / .gs point at github.com (a folder blob URL redirects to tree)', () => {
    const BI = readmeSource('https://github.com/voanhduy1710/Portfolio-projects')
    const html = render(
      '[**2. Excel – Adidas Sales**](2.%20Excel%20-%20Addidas%20Sales) [sc](4.%20Supply%20chain%20%26%20Sales) [q](5.%20SQL_questions.md) [gs](6.%20Larksuite%20Auto%20report%20Google%20script.gs)',
      [],
      BI,
    )
    const base = 'https://github.com/voanhduy1710/Portfolio-projects/blob/main/'
    expect(html).toContain(`href="${base}2.%20Excel%20-%20Addidas%20Sales"`)
    expect(html).toContain(`href="${base}4.%20Supply%20chain%20%26%20Sales"`)
    expect(html).toContain(`href="${base}5.%20SQL_questions.md"`)
    expect(html).toContain(`href="${base}6.%20Larksuite%20Auto%20report%20Google%20script.gs"`)
  })

  it('BI README: a synced image under a folder with `&` is served from the site, encoded per segment', () => {
    const BI = readmeSource('https://github.com/voanhduy1710/Portfolio-projects')
    const path = '4. Supply chain & Sales/4. Supply chain & Sales Dashboard.png'
    const html = toHtml(
      renderReadmeTree('![Supply](4.%20Supply%20chain%20%26%20Sales/4.%20Supply%20chain%20%26%20Sales%20Dashboard.png)', {
        slug: 'data-analyst-portfolio',
        source: BI,
        images: new Set([path]),
      }),
    )
    expect(html).toContain(
      'src="/content/project-readmes/data-analyst-portfolio/4.%20Supply%20chain%20%26%20Sales/4.%20Supply%20chain%20%26%20Sales%20Dashboard.png"',
    )
    expect(html).not.toContain('raw.githubusercontent.com')
  })

  it('gives headings GitHub-style ids so in-page anchors work', () => {
    const html = render('### 3. Configure Environment Variables\n\n## Testing & Code Quality')
    expect(html).toContain('<h3 id="3-configure-environment-variables">')
    expect(html).toContain('<h2 id="testing--code-quality">')
  })

  it('renders GFM: tables, task lists, strikethrough, fenced code with its language, details/summary', () => {
    const html = render(
      [
        '| a | b |',
        '|---|:-:|',
        '| 1 | 2 |',
        '',
        '- [x] done',
        '- [ ] todo',
        '',
        '~~old~~',
        '',
        '```bash',
        'npm test',
        '```',
        '',
        '<details><summary>More</summary>',
        '',
        'hidden **text**',
        '',
        '</details>',
        '',
        '> quoted',
      ].join('\n'),
    )
    expect(html).toContain('<table>')
    expect(html).toMatch(/<td align="center">2<\/td>/)
    expect(html).toMatch(/<input type="checkbox" checked disabled>/)
    expect(html).toContain('<del>old</del>')
    expect(html).toContain('<code class="language-bash">npm test\n</code>')
    expect(html).toContain('<details><summary>More</summary>')
    expect(html).toContain('<strong>text</strong>')
    expect(html).toContain('<blockquote>')
  })

  it('strips scripts, styles, iframes, event handlers and javascript: URLs', () => {
    const html = render(
      [
        '<script>alert(1)</script>',
        '<style>body{display:none}</style>',
        '<iframe src="https://evil.example"></iframe>',
        '<img src="a.png" onerror="alert(2)">',
        '<a href="javascript:alert(3)" onclick="alert(4)">x</a>',
        '[y](javascript:alert(5))',
        '<div style="position:fixed">z</div>',
      ].join('\n\n'),
      ['a.png'],
    )
    expect(html).not.toMatch(/script|alert|iframe|onerror|onclick|javascript:|style|display:none|evil/i)
    expect(html).toContain('/content/project-readmes/caro-app/a.png')
  })
})
