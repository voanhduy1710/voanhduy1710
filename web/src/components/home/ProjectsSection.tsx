import { PageSection } from '@/components/PageSection'
import { ProjectCard } from '@/components/ProjectCard'
import type { SiteContent } from '@/lib/content'
import type { Lang } from '@/lib/content/types'
import { readmeCoverUrl } from '@/lib/projectReadmeManifest'
import { HomeSection } from './HomeSection'

/** Projects grouped by their `###` group heading; groups and projects keep README order. */
function byGroup(projects: SiteContent['projects']): [string, SiteContent['projects']][] {
  const groups = new Map<string, SiteContent['projects']>()
  for (const p of projects) groups.set(p.group, [...(groups.get(p.group) ?? []), p])
  return [...groups]
}

/**
 * The project cards grid, one block per group. Each card links to the project's page. A project without a profile
 * preview gets the first image of its synced README as its thumbnail (`readmeCover`, injectable for tests).
 */
export function ProjectsSection({
  title,
  lang,
  projects,
  readmeCover = readmeCoverUrl,
}: {
  title: string
  lang: Lang
  projects: SiteContent['projects']
  readmeCover?: (slug: string) => string | undefined
}) {
  return (
    <HomeSection id="projects" title={title}>
      {byGroup(projects).map(([group, list]) => (
        <PageSection key={group} title={group} heading="h3">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <ProjectCard key={p.slug} project={p} lang={lang} fallbackCover={p.images.length > 0 ? undefined : readmeCover(p.slug)} />
            ))}
          </div>
        </PageSection>
      ))}
    </HomeSection>
  )
}
