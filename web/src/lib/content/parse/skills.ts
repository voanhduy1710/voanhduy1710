import { ContentError } from '../errors'
import { inlineText, toInline } from '../inline'
import { childrenOfType, toMdast } from '../mdast'
import type { SkillRow } from '../types'

/** Splits on commas outside parentheses: `Python (Pandas, Polars), Git` -> `Python (Pandas, Polars)`, `Git`. */
function splitTopLevel(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts.map((p) => p.trim()).filter(Boolean)
}

export function parseSkills(md: string, file: string): SkillRow[] {
  const table = childrenOfType(toMdast(md), 'table')[0]
  if (!table) throw new ContentError(file, 'skills: expected a table (№ | Category | Tech & Tools)')
  return table.children.slice(1).map((row, i) => {
    if (row.children.length < 3) throw new ContentError(file, `skills: row ${i + 1} needs 3 cells`)
    const [, category, tools] = row.children.map((cell) => inlineText(toInline(cell.children)).trim())
    return { category, tools: splitTopLevel(tools) }
  })
}
