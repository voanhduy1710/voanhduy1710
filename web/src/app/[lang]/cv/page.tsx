import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CvDocument } from '@/components/cv/CvDocument'
import { CvToolbar } from '@/components/cv/CvToolbar'
import { loadContent } from '@/lib/content'
import { isLang, languageAlternates } from '@/lib/i18n/paths'
import { ui } from '@/lib/i18n/ui'
import '../../cv-print.css'

export async function generateMetadata({ params }: PageProps<'/[lang]/cv'>): Promise<Metadata> {
  const { lang } = await params
  if (!isLang(lang)) return {}
  return { title: `${ui(lang).pageCv} – ${loadContent(lang).header.name}`, alternates: languageAlternates('/cv') }
}

/** CV: the README as a printable A4 page, with a screen-only download / print toolbar. */
export default async function CvPage({ params }: PageProps<'/[lang]/cv'>) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const content = loadContent(lang)

  return (
    <div className="cv-page px-4 py-8 sm:px-8">
      <CvToolbar lang={lang} cvHref={content.cvHref} />
      <CvDocument content={content} />
    </div>
  )
}
