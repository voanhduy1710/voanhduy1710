import { ContentError } from '../errors'
import { inlineText, toInline } from '../inline'
import { childrenOfType, toMdast } from '../mdast'
import type { PartTimeData } from '../types'

/** `## Part-time Work` / `**Role**` / table `Year | Place | Type | Location` (header row skipped). */
export function parsePartTime(md: string, file: string): PartTimeData {
  const root = toMdast(md)
  const heading = root.children.find((n) => n.type === 'heading' && n.depth === 2)
  if (!heading || heading.type !== 'heading') throw new ContentError(file, 'part-time: expected a "## Title" heading')
  const title = inlineText(toInline(heading.children)).trim()

  let role: string | undefined
  for (const p of childrenOfType(root, 'paragraph')) {
    const strong = toInline(p.children).find((i) => i.kind === 'strong')
    if (strong) {
      role = inlineText(strong.children).trim()
      break
    }
  }
  if (!role) throw new ContentError(file, 'part-time: expected a **Role** line')

  const table = childrenOfType(root, 'table')[0]
  if (!table) throw new ContentError(file, 'part-time: expected a table (Year | Place | Type | Location)')
  const jobs = table.children.slice(1).map((row, i) => {
    if (row.children.length < 4) throw new ContentError(file, `part-time: row ${i + 1} needs 4 cells`)
    const [year, place, type, location] = row.children.map((cell) => inlineText(toInline(cell.children)).trim())
    return { year, place, type, location }
  })
  if (jobs.length === 0) throw new ContentError(file, 'part-time: the table has no rows')
  return { title, role, jobs }
}
