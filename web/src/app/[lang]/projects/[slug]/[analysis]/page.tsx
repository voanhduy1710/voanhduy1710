import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { analysisHref } from '@/components/AnalysisCards'
import { CodeView } from '@/components/CodeView'
import { ProjectReadme } from '@/components/ProjectReadme'
import { SectionLink } from '@/components/shell/SectionLink'
import { loadContent } from '@/lib/content'
import { LANGS } from '@/lib/content/types'
import { isLang, languageAlternates } from '@/lib/i18n/paths'
import { ui } from '@/lib/i18n/ui'
import { analysisLinkTarget, analyticsSlugs, loadProjectAnalyses } from '@/lib/projectAnalyses'
import { shiftHeadings } from '@/lib/projectReadme/analyses'

/**
 * One page per analysis of the analytics project (`### 3. Uber Trips` in its README -> `/{lang}/projects/<slug>/
 * uber-trips`), both languages, prerendered. Next passes the parent `[lang]` / `[slug]` params when it has them.
 * An unknown analysis gets notFound() (`dynamicParams = false` is rejected while `cacheComponents` is on).
 */
export async function generateStaticParams({ params }: { params?: { lang?: string; slug?: string } } = {}) {
  const langs = LANGS.filter((l) => params?.lang === undefined || params.lang === l)
  return langs.flatMap((lang) => {
    const projects = loadContent(lang).projects
    const analytics = analyticsSlugs(projects)
    return projects
      .filter((p) => analytics.has(p.slug) && (params?.slug === undefined || params.slug === p.slug))
      .flatMap((p) => (loadProjectAnalyses(p.slug, lang)?.analyses ?? []).map((a) => ({ lang, slug: p.slug, analysis: a.slug })))
  })
}

/** Like the project pages: every analysis page is prerendered, so a blocking navigation is fine. */
export const instant = false

function findAnalysis(lang: string, slug: string, analysis: string) {
  if (!isLang(lang)) return undefined
  const content = loadContent(lang)
  const project = content.projects.find((p) => p.slug === slug)
  if (!project || !analyticsSlugs(content.projects).has(slug)) return undefined
  const split = loadProjectAnalyses(slug, lang)
  const index = split?.analyses.findIndex((a) => a.slug === analysis) ?? -1
  if (!split || index < 0) return undefined
  return { lang, project, split, index, analysis: split.analyses[index], name: content.header.name }
}

export async function generateMetadata({ params }: PageProps<'/[lang]/projects/[slug]/[analysis]'>): Promise<Metadata> {
  const { lang, slug, analysis } = await params
  const found = findAnalysis(lang, slug, analysis)
  return found
    ? {
        title: `${found.analysis.title} – ${found.project.title} – ${found.name}`,
        alternates: languageAlternates(`/projects/${slug}/${analysis}`),
      }
    : {}
}

const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const

export default async function AnalysisPage({ params }: PageProps<'/[lang]/projects/[slug]/[analysis]'>) {
  const { lang: rawLang, slug, analysis: analysisSlug } = await params
  const found = findAnalysis(rawLang, slug, analysisSlug)
  if (!found) notFound()
  const { lang, project, split, index, analysis } = found
  const t = ui(lang)
  const { readme } = split
  const linkTarget = analysisLinkTarget(analysis.files)
  const prev = split.analyses[index - 1]
  const next = split.analyses[index + 1]
  const overview = `/${lang}/projects/${project.slug}`

  return (
    <article className="mx-auto max-w-4xl px-5 py-10 sm:px-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-vsc-muted">
        <SectionLink lang={lang} section="projects" className="hover:text-vsc-link">
          ← {t.backToProjects}
        </SectionLink>
        <span aria-hidden>/</span>
        <Link href={overview} className="hover:text-vsc-link">
          {project.title}
        </Link>
      </nav>
      <p className="mt-6 text-xs tracking-wide text-vsc-muted uppercase">{project.group}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-vsc-heading">
        <span className="mr-2 font-mono text-2xl text-vsc-muted">{analysis.number}.</span>
        {analysis.title}
      </h1>
      <div data-project-links className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        {analysis.powerBiUrl && (
          <a
            href={analysis.powerBiUrl}
            {...EXTERNAL}
            data-powerbi
            className="inline-flex items-center gap-1.5 rounded bg-[#f2c811] px-3 py-1.5 font-semibold text-[#1e1e1e] transition-colors hover:bg-[#ffd83a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2c811]"
          >
            {t.openDashboard} ↗
          </a>
        )}
        <a href={project.repoUrl} {...EXTERNAL} className="text-vsc-link hover:underline">
          {t.repository} ↗
        </a>
      </div>

      <ProjectReadme
        slug={project.slug}
        repoUrl={readme.repoUrl}
        markdown={analysis.body}
        images={readme.images}
        note={readme.lang === lang ? undefined : t.readmeEnglishOnly || undefined}
        label={analysis.title}
        linkTarget={linkTarget}
      />

      {analysis.files.map((f) => (
        <section key={f.path} id={f.anchor} aria-labelledby={`${f.anchor}-title`} className="mt-10 scroll-mt-4">
          <h2 id={`${f.anchor}-title`} className="mb-4 border-b border-vsc-border pb-2 font-mono text-lg text-vsc-heading">
            {f.name}
          </h2>
          {f.kind === 'markdown' ? (
            <ProjectReadme
              slug={project.slug}
              repoUrl={readme.repoUrl}
              markdown={shiftHeadings(f.text, 1)}
              images={readme.images}
              label={f.name}
              className="mt-0"
              linkTarget={linkTarget}
            />
          ) : (
            <CodeView embedded root={project.repoUrl.split('/').pop() ?? project.slug} name={f.name} icon="file" syntax="ts" text={f.text} />
          )}
        </section>
      ))}

      {(prev || next) && (
        <nav aria-label={project.title} className="mt-12 flex flex-wrap justify-between gap-4 border-t border-vsc-border pt-5 text-sm">
          {prev ? (
            <Link href={analysisHref(lang, project.slug, prev.slug)} className="text-vsc-link hover:underline">
              ← {t.previousAnalysis}: {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={analysisHref(lang, project.slug, next.slug)} className="text-vsc-link hover:underline">
              {t.nextAnalysis}: {next.title} →
            </Link>
          )}
        </nav>
      )}
    </article>
  )
}
