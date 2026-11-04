import { ContentError } from '../errors'
import { inlineText, toInline } from '../inline'
import { itemInline, toMdast } from '../mdast'
import type { ExperienceEntry } from '../types'

type Draft = { company: string; role?: string; when?: string; bullets: ExperienceEntry['bullets'] }

function finish(d: Draft, file: string): ExperienceEntry {
  if (!d.role) throw new ContentError(file, `experience: ${d.company}: expected a **Role** line`)
  if (d.when === undefined) throw new ContentError(file, `experience: ${d.company}: expected a *period | location* line`)
  const bar = d.when.indexOf('|')
  if (bar === -1) throw new ContentError(file, `experience: ${d.company}: italic line needs "period | location": ${d.when}`)
  return {
    company: d.company,
    role: d.role,
    period: d.when.slice(0, bar).trim(),
    location: d.when.slice(bar + 1).trim(),
    bullets: d.bullets,
  }
}

/** `### Company` / `**Role**` / `*period | location*` / bullet list, repeated. */
export function parseExperience(md: string, file: string): ExperienceEntry[] {
  const drafts: Draft[] = []
  for (const node of toMdast(md).children) {
    if (node.type === 'heading' && node.depth === 3) {
      drafts.push({ company: inlineText(toInline(node.children)).trim(), bullets: [] })
      continue
    }
    const current = drafts[drafts.length - 1]
    if (!current) continue
    if (node.type === 'paragraph') {
      // The role and period lines may share a paragraph (hard break) or be separate paragraphs.
      for (const part of toInline(node.children)) {
        if (part.kind === 'strong' && current.role === undefined) current.role = inlineText(part.children).trim()
        else if (part.kind === 'em' && current.when === undefined) current.when = inlineText(part.children).trim()
      }
    } else if (node.type === 'list') {
      current.bullets.push(...node.children.map(itemInline))
    }
  }
  if (drafts.length === 0) throw new ContentError(file, 'experience: expected "### Company" entries')
  return drafts.map((d) => finish(d, file))
}
