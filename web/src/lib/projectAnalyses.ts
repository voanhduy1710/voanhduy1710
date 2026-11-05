import { imageSources, renderReadmeTree } from './projectReadme/render'
import {
  analysisIcon,
  analysisSlugs,
  type AnalysisIcon,
  fileAnchor,
  linkedFileKind,
  linkedFiles,
  powerBiUrl,
  sectionSummary,
  shiftHeadings,
  splitAnalyses,
  withoutDashboardParagraph,
  type LinkedFileKind,
} from './projectReadme/analyses'
import { readmeSource, type ReadmeSource } from './projectReadme/source'
import { loadProjectReadme, loadProjectReadmeFile, type LoadedProjectReadme } from './projectReadmeManifest'
import { splitGroups } from './projectGroups'

/** A repo file an analysis links to, shown on its page (the sync saved it; see sync-project-readmes.ts). */
export type AnalysisFile = { path: string; name: string; anchor: string; kind: LinkedFileKind; text: string }

export type Analysis = {
  /** `3` for `### 3. Uber Trips`. */
  number: string
  /** URL segment, from the English title (the same on /en and /vi). */
  slug: string
  title: string
  /** The section's markdown for its own page: sub-section headings moved up so `####` is an `##`. */
  body: string
  /** One line for the overview card (`Skills Used: ...`). */
  summary: string
  /** Explorer/tab icon, from the English section's skills line (see analysisIcon). */
  icon: AnalysisIcon
  /** The section's published Power BI report, if it links to one. */
  powerBiUrl?: string
  /** Served URL of the first image the section shows. */
  cover?: string
  files: AnalysisFile[]
}

export type ProjectAnalyses = {
  readme: LoadedProjectReadme
  intro: string
  heading: string
  lead: string
  analyses: Analysis[]
  rest: string
}

/**
 * Where a repo-relative link of the analytics README goes: a file the page shows in-page -> its anchor; anything
 * else -> no link (the owner does not want visitors sent to GitHub from the analyses).
 */
export function analysisLinkTarget(files: readonly Pick<AnalysisFile, 'path' | 'anchor'>[]): (path: string) => string | null {
  return (path) => {
    const file = files.find((f) => f.path === path)
    return file ? `#${file.anchor}` : null
  }
}

function firstImage(markdown: string, slug: string, source: ReadmeSource, images: readonly string[]): string | undefined {
  return imageSources(renderReadmeTree(markdown, { slug, source, images: new Set(images) }))[0]
}

/**
 * The analytics project's README split into its analyses (README.md on /en, READMEVN.md on /vi, matched by section
 * number so both share the English slugs), or undefined when it has no synced README or no numbered analyses.
 * Each analysis carries the linked files the sync saved.
 */
export function loadProjectAnalyses(slug: string, lang: 'en' | 'vi'): ProjectAnalyses | undefined {
  const en = loadProjectReadme(slug, 'en')
  if (!en) return undefined
  const enSplit = splitAnalyses(en.markdown)
  if (!enSplit || enSplit.sections.length === 0) return undefined
  const readme = lang === 'en' ? en : loadProjectReadme(slug, lang)!
  const split = (readme.lang === lang && splitAnalyses(readme.markdown)) || enSplit
  const source = readmeSource(readme.repoUrl)
  const slugs = analysisSlugs(enSplit.sections)
  const analyses = [...slugs].map(([number, analysisSlug]): Analysis => {
    const section = split.sections.find((s) => s.number === number) ?? enSplit.sections.find((s) => s.number === number)!
    const files = linkedFiles(section.body, source).flatMap((path): AnalysisFile[] => {
      const kind = linkedFileKind(path)
      const text = loadProjectReadmeFile(slug, path)
      return kind && text !== undefined ? [{ path, name: path.split('/').pop()!, anchor: fileAnchor(path), kind, text }] : []
    })
    const dashboard = powerBiUrl(section.body)
    const cover = firstImage(section.body, slug, source, readme.images)
    return {
      number,
      slug: analysisSlug,
      title: section.title,
      // The dashboard sentence becomes the page's button, so its paragraph is not shown again in the body.
      body: shiftHeadings(dashboard ? withoutDashboardParagraph(section.body) : section.body, -2),
      summary: sectionSummary(section.body),
      icon: analysisIcon(sectionSummary(enSplit.sections.find((s) => s.number === number)!.body)),
      ...(dashboard && { powerBiUrl: dashboard }),
      ...(cover && { cover }),
      files,
    }
  })
  return { readme, intro: split.intro, heading: split.heading, lead: split.lead, analyses, rest: split.rest }
}

/** The analytics projects (README's second group) among `projects`. */
export function analyticsSlugs(projects: readonly { slug: string; group?: string }[]): Set<string> {
  return new Set(splitGroups([...projects]).analytics.map((p) => p.slug))
}

/** For the nav model: each analytics project with its analyses (slug, title, cover); other projects unchanged. */
export function withAnalyses<P extends { slug: string; group?: string }>(
  lang: 'en' | 'vi',
  projects: readonly P[],
): (P & { analyses?: { slug: string; title: string; icon: AnalysisIcon; cover?: string }[] })[] {
  const analytics = analyticsSlugs(projects)
  return projects.map((p) => {
    if (!analytics.has(p.slug)) return p
    const found = loadProjectAnalyses(p.slug, lang)
    return found ? { ...p, analyses: found.analyses.map((a) => ({ slug: a.slug, title: a.title, icon: a.icon, ...(a.cover && { cover: a.cover }) })) } : p
  })
}
