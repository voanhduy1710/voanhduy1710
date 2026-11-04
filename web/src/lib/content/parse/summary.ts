import { ContentError } from '../errors'
import { toInline, trimInline } from '../inline'
import { childrenOfType, toMdast } from '../mdast'
import type { Inline } from '../types'

export function parseSummary(md: string, file: string): Inline[][] {
  const paragraphs = childrenOfType(toMdast(md), 'paragraph').map((p) => trimInline(toInline(p.children)))
  if (paragraphs.length === 0) throw new ContentError(file, 'summary: expected at least one paragraph')
  return paragraphs
}
