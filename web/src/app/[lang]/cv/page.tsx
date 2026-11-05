import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CvDocument } from '@/components/cv/CvDocument'
import { CvToolbar } from '@/components/cv/CvToolbar'
import { loadContent } from '@/lib/content'
import { loadCvHtml } from '@/lib/cv/html'
import { isLang, languageAlternates } from '@/lib/i18n/paths'
import { ui } from '@/lib/i18n/ui'
import '../../../../public/cv/cv.css'
import '../../cv-print.css'

export async function generateMetadata({ params }: PageProps<'/[lang]/cv'>): Promise<Metadata> {
  const { lang } = await params
  if (!isLang(lang)) return {}
  return { title: `${ui(lang).pageCv} – ${loadCvHtml(lang).name}`, alternates: languageAlternates('/cv') }
}

/**
 * CV: `public/cv/CV_EN.html` / `CV_VN.html` (design: `public/cv/cv.css`) as a printable A4 page, with a screen-only
 * download / print toolbar. The Download PDF link stays the README's CV link (`CV_Vo Anh Duy_EN.pdf` / `_VN.pdf`), the
 * same file the explorer's CV row is named after; export_cv.ps1 prints the two HTML files to those PDFs.
 */
export default async function CvPage({ params }: PageProps<'/[lang]/cv'>) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const { cvHref } = loadContent(lang)

  return (
    <div className="cv-screen px-4 py-8 sm:px-8">
      <CvToolbar lang={lang} cvHref={cvHref} />
      <CvDocument cv={loadCvHtml(lang)} />
    </div>
  )
}
