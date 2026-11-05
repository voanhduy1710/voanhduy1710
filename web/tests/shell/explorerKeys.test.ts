import { describe, expect, it } from 'vitest'
import { foldersHolding, treeOf, type ExplorerLabels, type TreeNode } from '@/components/shell/Explorer'
import { buildNav } from '@/lib/nav'

const labels = new Proxy({}, { get: (_t, k) => String(k) }) as ExplorerLabels

const keysOf = (nodes: TreeNode[]): string[] => nodes.flatMap((n) => [n.key, ...(n.kind === 'folder' ? keysOf(n.children) : [])])

describe('explorer row keys', () => {
  it('are unique even when a text-only certificate sits at the index of a PDF certificate number', () => {
    const certs = [
      ...Array.from({ length: 7 }, (_, i) => ({ no: i + 1, name: `Cert ${i + 1}`, href: i === 0 ? 'https://x.test' : undefined, status: 'Completed' })),
      { no: 8, name: 'In progress cert', status: 'In progress' },
    ]
    const nav = buildNav('en', [], certs, new Set([2, 3, 4, 5, 6, 7]))
    const keys = keysOf(treeOf(nav, labels))
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('cert:7')
    expect(keys).toContain('cert-text:8')
    expect(keys).toContain('cert-link:1')
  })
})

describe('BI analysis rows', () => {
  const projects = [
    { slug: 'caro', title: 'Caro', group: 'Full-Stack', badges: [] },
    {
      slug: 'da',
      title: 'DA',
      group: 'Analytics',
      badges: [],
      analyses: [
        { slug: 'uber-trips', title: 'Uber Trips' },
        { slug: 'sql', title: 'SQL' },
      ],
    },
  ]
  const tree = treeOf(buildNav('en', projects), labels)
  const bi = (tree.find((n) => n.key === 'src') as Extract<TreeNode, { kind: 'folder' }>).children.find((n) => n.key === 'bi') as Extract<
    TreeNode,
    { kind: 'folder' }
  >

  it('each row is its own page (first row of its page, so it is highlighted when that page is shown)', () => {
    expect(bi.children.map((n) => (n.kind === 'page' ? [n.label, n.page.href, n.first] : n.kind))).toEqual([
      ['Uber Trips', '/en/projects/da/uber-trips', true],
      ['SQL', '/en/projects/da/sql', true],
    ])
  })

  it('the folders holding the page shown are revealed: src and BI projects for an analysis, none for the overview', () => {
    expect([...foldersHolding(tree, 'analysis:da/sql')].sort()).toEqual(['bi', 'src'])
    expect(foldersHolding(tree, 'project:da').size).toBe(0)
    expect(foldersHolding(tree, undefined).size).toBe(0)
  })
})
