import type { ListItem, Root, RootContent } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { ContentError } from './errors'
import { inlineText, toInline, trimInline } from './inline'
import type { Inline } from './types'

const processor = unified().use(remarkParse).use(remarkGfm)

export function toMdast(markdown: string): Root {
  // remark-gfm only adds parser extensions, so parsing alone yields the full GFM tree (tables, autolinks).
  return processor.parse(markdown)
}

/** Top-level children of `root` with the given node type. */
export function childrenOfType<T extends RootContent['type']>(
  root: Root,
  type: T,
): Extract<RootContent, { type: T }>[] {
  return root.children.filter((n): n is Extract<RootContent, { type: T }> => n.type === type)
}

/** Concatenated values of the top-level html nodes (README `<h1>`, `<img>` blocks...). */
export function htmlOf(root: Root): string {
  return childrenOfType(root, 'html')
    .map((n) => n.value)
    .join('\n')
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Decodes the HTML entities that can appear in README html blocks. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1].toLowerCase() === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[ref.toLowerCase()] ?? whole
  })
}

/** Items of the first top-level list in `md`; throws naming `section` if there is none. */
export function firstListItems(md: string, file: string, section: string): ListItem[] {
  const list = childrenOfType(toMdast(md), 'list')[0]
  if (!list) throw new ContentError(file, `${section}: expected a bullet list`)
  return list.children
}

/** Splits a `- **Label:** rest` list item into the label (colon removed) and the inline content after it. */
export function labelledItem(item: ListItem, file: string, section: string): { label: string; rest: Inline[] } {
  const p = item.children[0]
  const [head, ...rest] = p?.type === 'paragraph' ? toInline(p.children) : []
  if (head?.kind !== 'strong') throw new ContentError(file, `${section}: expected "- **Label:** value" list items`)
  let label = inlineText(head.children).trim()
  if (label.endsWith(':')) {
    label = label.slice(0, -1).trim()
  } else if (rest[0]?.kind === 'text' && rest[0].value.startsWith(':')) {
    rest[0] = { kind: 'text', value: rest[0].value.slice(1) }
  }
  return { label, rest }
}

/** Inline content of a list item's first paragraph, trimmed (nested lists are ignored). */
export function itemInline(item: ListItem): Inline[] {
  const p = item.children[0]
  return p?.type === 'paragraph' ? trimInline(toInline(p.children)) : []
}

const IMG = /<img\b([^>]*)>/gi
const ATTR = /([a-z-]+)\s*=\s*"([^"]*)"/gi

/** Attributes (lower-cased names, entity-decoded values) of every `<img>` tag in `html`, plus the raw tag. */
export function htmlImages(html: string): { tag: string; attrs: Record<string, string> }[] {
  return [...html.matchAll(IMG)].map((m) => ({
    tag: m[0],
    attrs: Object.fromEntries([...m[1].matchAll(ATTR)].map((a) => [a[1].toLowerCase(), decodeEntities(a[2])])),
  }))
}

/** URI-decodes a README-relative asset path (`%20` -> space); throws naming `section` if malformed. */
export function decodeAssetPath(src: string, file: string, section: string): string {
  try {
    return decodeURI(src)
  } catch {
    throw new ContentError(file, `${section}: malformed URI in <img src>: ${src}`)
  }
}
