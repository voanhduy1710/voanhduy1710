import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProjectReadme } from '@/components/ProjectReadme'
import { loadContent } from '@/lib/content'
import { isLang, languageAlternates } from '@/lib/i18n/paths'
import { ui } from '@/lib/i18n/ui'
import { PROFILE_README_FILES, PROFILE_URL } from '@/lib/nav'
import { loadProfileReadme, PROFILE_REPO_URL, profileReadmeImageUrl, profileReadmeLinkTarget } from '@/lib/profileReadme'

export async function generateMetadata({ params }: PageProps<'/[lang]/readme'>): Promise<Metadata> {
  const { lang } = await params
  if (!isLang(lang)) return {}
  return { title: `${PROFILE_README_FILES[lang]} – ${loadContent(lang).header.name}`, alternates: languageAlternates('/readme') }
}

/**
 * The profile README as a markdown preview (VS Code's "Open Preview"), prerendered per language: `README.md` on /en,
 * `READMEVN.md` on /vi. Same renderer and sanitiser as the project READMEs; its `web/public/...` images are served by
 * the site, its CV links go to the synced PDFs, README.md <-> READMEVN.md links to the other preview. The hidden
 * `<!-- section/project/site -->` markers are HTML comments, which the sanitiser drops.
 */
export default async function ProfileReadmePage({ params }: PageProps<'/[lang]/readme'>) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const file = PROFILE_README_FILES[lang]
  return (
    <article className="mx-auto max-w-4xl px-5 py-8 sm:px-10">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-vsc-border pb-2 font-mono text-xs text-vsc-muted">
        <span>{file}</span>
        <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="text-vsc-link hover:underline">
          {ui(lang).viewOnGitHub} ↗
        </a>
      </div>
      <ProjectReadme
        slug="voanhduy1710"
        repoUrl={PROFILE_REPO_URL}
        markdown={loadProfileReadme(lang)}
        images={[]}
        imageUrl={profileReadmeImageUrl}
        linkTarget={profileReadmeLinkTarget}
        label={file}
        className=""
      />
    </article>
  )
}
