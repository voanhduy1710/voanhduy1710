import type { PhrasingContent } from 'mdast'
import type { Inline } from './types'

function convert(node: PhrasingContent): Inline[] {
  switch (node.type) {
    case 'text':
      return [{ kind: 'text', value: node.value }]
    case 'strong':
      return [{ kind: 'strong', children: toInline(node.children) }]
    case 'emphasis':
      return [{ kind: 'em', children: toInline(node.children) }]
    case 'inlineCode':
      return [{ kind: 'code', value: node.value }]
    case 'link':
      return [{ kind: 'link', href: node.url, children: toInline(node.children) }]
    case 'break':
      return [{ kind: 'text', value: '\n' }]
    case 'delete':
      return toInline(node.children)
    default:
      // Inline html, images and footnote references carry no text the site renders.
      return []
  }
}

/** Converts mdast phrasing nodes to the site's inline model, merging adjacent text. */
export function toInline(nodes: PhrasingContent[]): Inline[] {
  const out: Inline[] = []
  for (const item of nodes.flatMap(convert)) {
    const last = out[out.length - 1]
    if (item.kind === 'text' && last?.kind === 'text') {
      out[out.length - 1] = { kind: 'text', value: last.value + item.value }
    } else {
      out.push(item)
    }
  }
  return out
}

export function inlineText(inlines: Inline[]): string {
  return inlines.map((i) => (i.kind === 'text' || i.kind === 'code' ? i.value : inlineText(i.children))).join('')
}

/** Trims whitespace at the start of a leading text node and the end of a trailing one, dropping emptied nodes. */
export function trimInline(inlines: Inline[]): Inline[] {
  const out = [...inlines]
  const first = out[0]
  if (first?.kind === 'text') {
    const value = first.value.trimStart()
    if (value) out[0] = { kind: 'text', value }
    else out.shift()
  }
  const last = out[out.length - 1]
  if (last?.kind === 'text') {
    const value = last.value.trimEnd()
    if (value) out[out.length - 1] = { kind: 'text', value }
    else out.pop()
  }
  return out
}
