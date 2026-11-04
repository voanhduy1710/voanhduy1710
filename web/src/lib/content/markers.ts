import { ContentError } from './errors'
import { SECTION_IDS, type SectionId } from './types'

// Markers are matched loosely (any spacing, any id text) so a sloppy id is reported instead of silently skipped.
const SECTION_OPEN = /<!--\s*section\s*:\s*([^>]*?)\s*-->/
const SECTION_CLOSE = /<!--\s*\/\s*section\s*-->/
const MARKER = new RegExp(`${SECTION_OPEN.source}|${SECTION_CLOSE.source}`, 'g')
const PROJECT_MARKER = /<!--\s*project\s*:\s*([^>]*?)\s*-->/g
const PROJECT_SLUG = /^[a-z0-9-]+$/

function isSectionId(id: string): id is SectionId {
  return (SECTION_IDS as readonly string[]).includes(id)
}

export function extractSections(markdown: string, file: string): Record<SectionId, string> {
  const found = new Map<SectionId, string>()
  let open: { id: SectionId; start: number } | null = null

  for (const m of markdown.matchAll(MARKER)) {
    const index = m.index ?? 0
    const id = m[1]
    if (id !== undefined) {
      if (!isSectionId(id)) {
        throw new ContentError(file, `unknown section id: ${id} (valid ids: ${SECTION_IDS.join(', ')})`)
      }
      if (open) throw new ContentError(file, `nested section: ${id} opened inside ${open.id}`)
      if (found.has(id)) throw new ContentError(file, `duplicate section: ${id}`)
      open = { id, start: index + m[0].length }
    } else {
      if (!open) throw new ContentError(file, 'unexpected closing marker <!-- /section -->')
      found.set(open.id, markdown.slice(open.start, index))
      open = null
    }
  }

  if (open) throw new ContentError(file, `unclosed section: ${open.id}`)

  const missing = SECTION_IDS.filter((id) => !found.has(id))
  if (missing.length > 0) {
    throw new ContentError(file, `missing section: ${missing.join(', ')}`)
  }
  return Object.fromEntries(SECTION_IDS.map((id) => [id, found.get(id) as string])) as Record<SectionId, string>
}

export function extractProjectBlocks(
  sectionMarkdown: string,
  file: string,
): { slug: string; markdown: string }[] {
  const matches = [...sectionMarkdown.matchAll(PROJECT_MARKER)]
  const seen = new Set<string>()
  return matches.map((m, i) => {
    const slug = m[1]
    if (!PROJECT_SLUG.test(slug)) throw new ContentError(file, `invalid project slug: ${slug}`)
    if (seen.has(slug)) throw new ContentError(file, `duplicate project: ${slug}`)
    seen.add(slug)
    const start = m.index ?? 0
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? sectionMarkdown.length) : sectionMarkdown.length
    return { slug, markdown: sectionMarkdown.slice(start, end) }
  })
}

/**
 * The text of one section, or undefined when the README has no such section. Lenient on purpose (no checks of the
 * other markers): the content sync uses it before the full parse, which still reports every marker problem.
 */
export function findSection(markdown: string, id: SectionId): string | undefined {
  const open = new RegExp(`<!--\\s*section\\s*:\\s*${id}\\s*-->`).exec(markdown)
  if (!open) return undefined
  const rest = markdown.slice(open.index + open[0].length)
  const close = SECTION_CLOSE.exec(rest)
  return close ? rest.slice(0, close.index) : undefined
}
