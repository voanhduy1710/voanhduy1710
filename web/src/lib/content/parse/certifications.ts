import { ContentError } from '../errors'
import { inlineText, toInline, trimInline } from '../inline'
import { childrenOfType, toMdast } from '../mdast'
import type { Certification } from '../types'

/**
 * The Certifications table: `№ | Certificate | Status`. `№` is a positive whole number, unique in the table; it is
 * the number the certificate's PDF file starts with in the voanhduy1710/Certifications repo (`1. Google ….pdf`).
 */
export function parseCertifications(md: string, file: string): Certification[] {
  const table = childrenOfType(toMdast(md), 'table')[0]
  if (!table) throw new ContentError(file, 'certifications: expected a table (№ | Certificate | Status)')
  const seen = new Set<number>()
  return table.children.slice(1).map((row, i) => {
    if (row.children.length < 3) throw new ContentError(file, `certifications: row ${i + 1} needs 3 cells`)
    const noText = inlineText(toInline(row.children[0].children)).trim()
    if (!/^\d+$/.test(noText) || Number(noText) < 1) {
      throw new ContentError(file, `certifications: row ${i + 1} needs a whole number ≥ 1 in the № cell, got "${noText}"`)
    }
    const no = Number(noText)
    if (seen.has(no)) throw new ContentError(file, `certifications: row ${i + 1} uses № ${no} more than once`)
    seen.add(no)
    const nameCell = trimInline(toInline(row.children[1].children))
    const status = inlineText(toInline(row.children[2].children)).trim()
    const name = inlineText(nameCell).trim()
    const link = nameCell.length === 1 && nameCell[0].kind === 'link' ? nameCell[0] : undefined
    return link ? { no, name, href: link.href, status } : { no, name, status }
  })
}
