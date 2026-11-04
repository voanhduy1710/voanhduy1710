import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CodeView } from '@/components/CodeView'
import { loadContent } from '@/lib/content'
import { LANGS } from '@/lib/content/types'
import { isLang, languageAlternates } from '@/lib/i18n/paths'
import { REPO_FILES, repoFileBySlug } from '@/lib/repoFiles'
import { readRepoFile } from '@/lib/repoFileText'

/**
 * One read-only page per allow-listed config file and language, prerendered with the file's contents as of the
 * build. Next passes the parent `[lang]` params when it has them. An unknown lang or file (e.g. `.env`) gets
 * notFound(): `dynamicParams = false` is rejected while `cacheComponents` is on.
 */
export async function generateStaticParams({ params }: { params?: { lang?: string } } = {}) {
  const langs = LANGS.filter((l) => params?.lang === undefined || params.lang === l)
  return langs.flatMap((lang) => REPO_FILES.map((f) => ({ lang, file: f.slug })))
}

/** Like the project pages: every file page is prerendered, so a blocking navigation is fine. */
export const instant = false

export async function generateMetadata({ params }: PageProps<'/[lang]/files/[file]'>): Promise<Metadata> {
  const { lang, file: slug } = await params
  const file = repoFileBySlug(slug)
  if (!isLang(lang) || !file) return {}
  return { title: `${file.name} – ${loadContent(lang).header.name}`, alternates: languageAlternates(`/files/${slug}`) }
}

export default async function RepoFilePage({ params }: PageProps<'/[lang]/files/[file]'>) {
  const { lang, file: slug } = await params
  const file = repoFileBySlug(slug)
  if (!isLang(lang) || !file) notFound()
  return <CodeView root="voanhduy1710" name={file.name} icon={file.icon} syntax={file.syntax} text={readRepoFile(file)} />
}
