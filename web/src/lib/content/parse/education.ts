import type { ListItem } from 'mdast'
import { ContentError } from '../errors'
import { inlineText, toInline, trimInline } from '../inline'
import { toMdast } from '../mdast'
import type { EducationData, Inline } from '../types'

type Degree = EducationData[number]['degrees'][number]

/** `**Degree**, years  \n*note*` -> text before the line break, plus the italic line as `note`. */
function parseDegree(item: ListItem, file: string): Degree {
  const p = item.children[0]
  if (p?.type !== 'paragraph') throw new ContentError(file, 'education: expected a degree line in each list item')
  const breakAt = p.children.findIndex((c) => c.type === 'break')
  const text = trimInline(toInline(breakAt === -1 ? p.children : p.children.slice(0, breakAt)))
  if (breakAt === -1) return { text }
  const after: Inline[] = trimInline(toInline(p.children.slice(breakAt + 1)))
  if (after.length === 1 && after[0].kind === 'em') return { text, note: inlineText(after[0].children).trim() }
  return { text: trimInline(toInline(p.children)) }
}

export function parseEducation(md: string, file: string): EducationData {
  const schools: EducationData = []
  for (const node of toMdast(md).children) {
    if (node.type === 'paragraph') {
      const inline = trimInline(toInline(node.children))
      if (inline.length === 1 && inline[0].kind === 'strong') {
        schools.push({ school: inlineText(inline[0].children).trim(), degrees: [] })
        continue
      }
    }
    if (node.type === 'list') {
      const current = schools[schools.length - 1]
      if (!current) throw new ContentError(file, 'education: degree list before a **School** line')
      current.degrees.push(...node.children.map((item) => parseDegree(item, file)))
    }
  }
  if (schools.length === 0) throw new ContentError(file, 'education: expected a **School** line')
  return schools
}
