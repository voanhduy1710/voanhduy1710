import type { Link } from 'mdast'
import { ContentError } from '../errors'
import { inlineText, toInline } from '../inline'
import { childrenOfType, decodeEntities, htmlOf, toMdast } from '../mdast'
import type { HeaderData } from '../types'

function headingText(html: string, tag: 'h1' | 'h3'): string | undefined {
  const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  const text = m ? decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim() : ''
  return text || undefined
}

const SITE_LINE = /<!--\s*site\s*:\s*(status|roles)\s*=\s*(.*?)\s*-->/g

/** Reads the invisible `<!-- site: status|roles = ... -->` lines (tolerant spacing; roles split on `|`). */
function siteLines(md: string): { status?: string; roles: string[] } {
  let status: string | undefined
  let roles: string[] = []
  for (const m of md.matchAll(SITE_LINE)) {
    if (m[1] === 'status') status = m[2] || undefined
    else roles = m[2].split('|').map((r) => r.trim()).filter(Boolean)
  }
  return { status, roles }
}

export function parseHeader(md: string, file: string): HeaderData {
  const root = toMdast(md)
  const html = htmlOf(root)
  const name = headingText(html, 'h1')
  if (!name) throw new ContentError(file, 'header: expected <h1> with the name')
  const title = headingText(html, 'h3')
  if (!title) throw new ContentError(file, 'header: expected <h3> with the title')

  const linkRow = childrenOfType(root, 'paragraph').find((p) => p.children.some((c) => c.type === 'link'))
  if (!linkRow) throw new ContentError(file, 'header: expected a paragraph of " | "-separated links')
  const links = linkRow.children
    .filter((c): c is Link => c.type === 'link')
    .map((l) => ({ label: inlineText(toInline(l.children)).trim(), href: l.url }))
  return { name, title, links, ...siteLines(md) }
}
