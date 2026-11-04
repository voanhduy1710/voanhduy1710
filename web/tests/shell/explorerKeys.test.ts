import { describe, expect, it } from 'vitest'
import { treeOf, type ExplorerLabels, type TreeNode } from '@/components/shell/Explorer'
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
