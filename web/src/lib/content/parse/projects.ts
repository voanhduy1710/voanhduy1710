import type { Heading, Image, Link, Paragraph, PhrasingContent } from 'mdast'
import { ContentError } from '../errors'
import { inlineText, toInline, trimInline } from '../inline'
import { extractProjectBlocks } from '../markers'
import { itemInline, toMdast } from '../mdast'
import type { Badge, Project } from '../types'
import { parseShieldsBadge } from './badges'

const isBlank = (n: PhrasingContent) => n.type === 'text' && n.value.trim() === ''

/** The image of a `![alt](src)` or `[![alt](src)](href)` node, with the link target if any. */
function badgeImage(n: PhrasingContent): { image: Image; href?: string } | undefined {
  if (n.type === 'image') return { image: n }
  if (n.type === 'link' && n.children.length === 1 && n.children[0].type === 'image') {
    return { image: n.children[0], href: n.url }
  }
  return undefined
}

/** Badges of a paragraph made only of badge images, or undefined if it holds no badges. */
function badgeParagraph(p: Paragraph, file: string, slug: string): Badge[] | undefined {
  const content = p.children.filter((n) => !isBlank(n))
  const images = content.map(badgeImage)
  if (images.every((i) => i === undefined)) return undefined
  if (images.some((i) => i === undefined)) {
    throw new ContentError(file, `projects: ${slug}: a badge paragraph may only contain badges (put text in its own paragraph)`)
  }
  return images.map((i) => {
    const { image, href } = i as { image: Image; href?: string }
    try {
      return parseShieldsBadge(image.url, image.alt ?? '', href)
    } catch (e) {
      throw new ContentError(file, `projects: ${slug}: ${(e as Error).message}`)
    }
  })
}

/** `*Label:* [text](url)` -> the label (colon dropped) and url. */
function liveLine(p: Paragraph): { liveLabel: string; liveUrl: string } | undefined {
  const [head, ...rest] = trimInline(toInline(p.children))
  if (head?.kind !== 'em') return undefined
  const label = inlineText(head.children).trim()
  if (!label.endsWith(':')) return undefined
  const link = rest.find((i) => !(i.kind === 'text' && i.value.trim() === ''))
  if (link?.kind !== 'link') return undefined
  return { liveLabel: label.slice(0, -1).trim(), liveUrl: link.href }
}

/** Text of an italic-only paragraph. */
function noteLine(p: Paragraph): string | undefined {
  const inline = trimInline(toInline(p.children))
  return inline.length === 1 && inline[0].kind === 'em' ? inlineText(inline[0].children).trim() : undefined
}

/** The `###` heading text in force at each character offset of the section. */
function groupAt(md: string): (offset: number) => string | undefined {
  const groups = toMdast(md)
    .children.filter((n): n is Heading => n.type === 'heading' && n.depth === 3)
    .map((h) => ({ at: h.position?.start.offset ?? 0, text: inlineText(toInline(h.children)).trim() }))
  return (offset) => groups.filter((g) => g.at < offset).pop()?.text
}

function parseProject(slug: string, markdown: string, group: string, file: string): Project {
  const project: Project = { slug, group, title: '', repoUrl: '', badges: [], description: [], bullets: [] }
  for (const node of toMdast(markdown).children) {
    if (node.type === 'heading') {
      if (node.depth <= 3) break // the next group's heading: not part of this project
      if (node.depth !== 4) continue
      if (project.title || project.repoUrl) {
        throw new ContentError(file, `projects: project ${slug} has more than one #### heading – missing marker?`)
      }
      const link = node.children.find((c): c is Link => c.type === 'link')
      if (!link) throw new ContentError(file, `projects: ${slug}: "####" title must be a link to the repository`)
      project.title = inlineText(toInline(node.children)).trim()
      project.repoUrl = link.url
    } else if (node.type === 'paragraph') {
      const badges = badgeParagraph(node, file, slug)
      const live = badges ? undefined : liveLine(node)
      const note = badges || live ? undefined : noteLine(node)
      if (badges) project.badges.push(...badges)
      else if (live && project.liveUrl === undefined) Object.assign(project, live)
      else if (note !== undefined && project.note === undefined) project.note = note
      else {
        const text = trimInline(toInline(node.children))
        if (text.length > 0) project.description.push(text)
      }
    } else if (node.type === 'list') {
      project.bullets.push(...node.children.map(itemInline))
    }
  }
  if (!project.repoUrl) throw new ContentError(file, `projects: ${slug}: expected a "#### [Title](repo-url)" heading`)
  return project
}

/** One `<!-- project: slug -->` entry per project; titles come from the `####` headings here only. */
export function parseProjects(md: string, file: string): Project[] {
  const blocks = extractProjectBlocks(md, file)
  if (blocks.length === 0) throw new ContentError(file, 'projects: expected <!-- project: slug --> entries')
  const groupOf = groupAt(md)
  return blocks.map(({ slug, markdown }) => {
    const group = groupOf(md.indexOf(markdown))
    if (!group) throw new ContentError(file, `projects: ${slug}: expected a "### Group" heading before it`)
    return parseProject(slug, markdown, group, file)
  })
}
