import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BadgeChip } from '@/components/BadgeChip'
import { ImageGallery } from '@/components/ImageGallery'
import { Inline } from '@/components/Inline'
import { PageSection } from '@/components/PageSection'
import { ProjectReadme, readmeHasH1 } from '@/components/ProjectReadme'
import { SectionLink } from '@/components/shell/SectionLink'
import { loadContent } from '@/lib/content'
import { assetUrl } from '@/lib/content/assets'
import { LANGS } from '@/lib/content/types'
import { isLang, languageAlternates } from '@/lib/i18n/paths'
import { ui } from '@/lib/i18n/ui'
import { AnalysisCards } from '@/components/AnalysisCards'
import { analyticsSlugs, loadProjectAnalyses } from '@/lib/projectAnalyses'
import { loadProjectReadme } from '@/lib/projectReadmeManifest'

/**
 * Every `{ lang, slug }` pair (both languages x every project). Next passes the parent `[lang]` params when it
 * has them, so the list is narrowed to that language. `dynamicParams = false` is rejected while `cacheComponents`
 * is on: an unknown lang or slug gets notFound() instead.
 */
export async function generateStaticParams({ params }: { params?: { lang?: string } } = {}) {
  const langs = LANGS.filter((l) => params?.lang === undefined || params.lang === l)
  return langs.flatMap((lang) => loadContent(lang).projects.map((p) => ({ lang, slug: p.slug })))
}

/**
 * The page reads `slug` outside <Suspense>, which Next's instant-navigation check flags in dev ("URL data during
 * prerendering"). Every project page is prerendered from generateStaticParams, so a blocking navigation is fine.
 */
export const instant = false

function findProject(lang: string, slug: string) {
  if (!isLang(lang)) return undefined
  const content = loadContent(lang)
  const project = content.projects.find((p) => p.slug === slug)
  return project && { lang, project, name: content.header.name, analytics: analyticsSlugs(content.projects).has(slug) }
}

export async function generateMetadata({ params }: PageProps<'/[lang]/projects/[slug]'>): Promise<Metadata> {
  const { lang, slug } = await params
  const found = findProject(lang, slug)
  return found ? { title: `${found.project.title} – ${found.name}`, alternates: languageAlternates(`/projects/${slug}`) } : {}
}

const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const

export default async function ProjectPage({ params }: PageProps<'/[lang]/projects/[slug]'>) {
  const { lang: rawLang, slug } = await params
  const found = findProject(rawLang, slug)
  if (!found) notFound()
  const { lang, project } = found
  const t = ui(lang)
  // The analytics project: its README's analyses each have their own page; here they are cards between the README's
  // intro and its closing sections (Tools & Programs, Contact). No README link leads to GitHub.
  const split = found.analytics ? loadProjectAnalyses(project.slug, lang) : undefined
  const noRepoLinks = () => null
  // Projects (My works and BI) show their own repo's full README (synced at build time; on /vi its READMEVN.md when
  // the repo has one, else the English README with a note) in place of the profile README's short summary. Its
  // screenshots replace the gallery, unless it shows none.
  const readme = loadProjectReadme(project.slug, lang)
  const readmeH1 = !!readme && readmeHasH1(readme.repoUrl, readme.markdown, project.slug, readme.images)
  const showSummary = !readme && (project.description.length > 0 || project.bullets.length > 0)
  const showGallery = project.images.length > 0 && !(readme && readme.images.length > 0)

  // Right after the page title (the README's H1, or the header title): the live / repository links, then the note.
  const afterTitle = (
    <>
      <div data-project-links className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {project.liveUrl && (
          <span>
            {project.liveLabel && <em className="text-vsc-muted">{project.liveLabel}: </em>}
            <a href={project.liveUrl} {...EXTERNAL} className="text-vsc-link hover:underline">
              {project.liveUrl.replace(/^https?:\/\/|\/$/g, '')}
            </a>
          </span>
        )}
        <a href={project.repoUrl} {...EXTERNAL} className="text-vsc-link hover:underline">
          {t.repository} ↗
        </a>
      </div>
      {project.note && <p className="mt-2 text-sm text-vsc-muted italic">{project.note}</p>}
    </>
  )

  return (
    <article className="mx-auto max-w-4xl px-5 py-10 sm:px-10">
      <SectionLink lang={lang} section="projects" className="font-mono text-xs text-vsc-muted hover:text-vsc-link">
        ← {t.backToProjects}
      </SectionLink>
      <p className="mt-6 text-xs tracking-wide text-vsc-muted uppercase">{project.group}</p>
      {!readmeH1 && <h1 className="mt-1 text-3xl font-semibold tracking-tight text-vsc-heading">{project.title}</h1>}
      {!readmeH1 && afterTitle}
      {!readme && project.badges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {project.badges.map((b, i) => (
            <BadgeChip key={i} badge={b} />
          ))}
        </div>
      )}

      {showSummary && (
        <div className="mt-8 max-w-3xl space-y-3 leading-relaxed">
          {project.description.map((p, i) => (
            <p key={i}>
              <Inline nodes={p} />
            </p>
          ))}
          {project.bullets.length > 0 && (
            <ul className="list-disc space-y-2 pl-5 marker:text-vsc-muted">
              {project.bullets.map((b, i) => (
                <li key={i}>
                  <Inline nodes={b} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {readme && split && (
        <>
          <ProjectReadme
            slug={project.slug}
            repoUrl={readme.repoUrl}
            markdown={`${split.intro}

## ${split.heading}

${split.lead}`}
            images={readme.images}
            note={readme.lang === lang ? undefined : t.readmeEnglishOnly || undefined}
            dropLanguageLink={readme.lang === 'vi'}
            afterTitle={readmeH1 ? afterTitle : undefined}
            linkTarget={noRepoLinks}
          />
          <AnalysisCards lang={lang} project={project.slug} analyses={split.analyses} />
          {split.rest && (
            <ProjectReadme
              slug={project.slug}
              repoUrl={readme.repoUrl}
              markdown={split.rest}
              images={readme.images}
              label={/^#+\s+(.+)$/m.exec(split.rest)?.[1] ?? 'README'}
              className="mt-10"
              linkTarget={noRepoLinks}
            />
          )}
        </>
      )}

      {readme && !split && (
        <ProjectReadme
          slug={project.slug}
          repoUrl={readme.repoUrl}
          markdown={readme.markdown}
          images={readme.images}
          note={readme.lang === lang ? undefined : t.readmeEnglishOnly || undefined}
          dropLanguageLink={readme.lang === 'vi'}
          afterTitle={readmeH1 ? afterTitle : undefined}
        />
      )}

      {showGallery && (
        <PageSection title={t.screenshots}>
          <ImageGallery
            images={project.images.map((img) => ({ src: assetUrl(img.src), alt: img.alt || project.title }))}
            labels={{ open: t.openImage, close: t.closeImage, previous: t.previousImage, next: t.nextImage }}
          />
        </PageSection>
      )}
    </article>
  )
}
