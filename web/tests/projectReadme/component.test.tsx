import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProjectReadme, readmeHasH1 } from '@/components/ProjectReadme'
import { parseProjectReadmeManifest } from '@/lib/projectReadmeManifest'

describe('ProjectReadme', () => {
  it('renders the README panel with native badge chips, synced images and read-only task boxes', () => {
    const html = renderToStaticMarkup(
      <ProjectReadme
        slug="caro-app"
        repoUrl="https://github.com/voanhduy1710/Caro-app"
        markdown={'# Caro\n\n[![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org/)\n\n![P](public/p.png)\n\n- [x] done\n'}
        images={['public/p.png']}
        note="README gốc bằng tiếng Anh"
      />,
    )
    expect(html).not.toContain('README.md')
    expect(html).toContain('README gốc bằng tiếng Anh')
    expect(html).not.toContain('shields.io')
    expect(html).not.toContain('badge-chip')
    expect(html).toContain('Node.js</span>')
    expect(html).toContain('background-color:#97ca00')
    expect(html).toContain('src="/content/project-readmes/caro-app/public/p.png"')
    expect(html).toMatch(/<input type="checkbox" disabled="" checked=""\/>/)
    expect(html).toContain('<h1 id="caro">')
  })

  it('keeps one h1: later H1s become h2, and readmeHasH1 reports presence', () => {
    const args = { slug: 's', repoUrl: 'https://github.com/o/r', images: [] as string[] }
    const html = renderToStaticMarkup(<ProjectReadme {...args} markdown={'# A\n\n# B\n'} />)
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('<h2 id="b">')
    expect(readmeHasH1(args.repoUrl, '# A', 's', [])).toBe(true)
    expect(readmeHasH1(args.repoUrl, 'text only\n\n## sub', 's', [])).toBe(false)
  })
})

describe('parseProjectReadmeManifest', () => {
  it('accepts { slug: { repoUrl, images } } and rejects anything else', () => {
    expect(parseProjectReadmeManifest('{"a":{"repoUrl":"https://github.com/o/r","images":["x.png"]}}')).toEqual({
      a: { repoUrl: 'https://github.com/o/r', images: ['x.png'] },
    })
    for (const bad of ['[]', 'null', '{"a":{"images":[]}}', '{"a":{"repoUrl":"u","images":[1]}}']) {
      expect(() => parseProjectReadmeManifest(bad), bad).toThrow('content/project-readmes.json must map project slugs')
    }
  })
})
