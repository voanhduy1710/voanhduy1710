'use client'

import type { Lang } from '@/lib/content/types'
import { ui } from '@/lib/i18n/ui'

const button =
  'inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium focus-visible:outline-offset-2'

/**
 * Screen-only bar above the CV: download the PDF exported from this page by export_cv.ps1 (`CV_Vo Anh Duy_EN.pdf` /
 * `_VN.pdf`, linked from the README), or print this page. The page renders public/cv/cv.{en,vi}.yaml.
 */
export function CvToolbar({ lang, cvHref }: { lang: Lang; cvHref: { en: string; vi: string } }) {
  const t = ui(lang)
  return (
    <div className="cv-toolbar mx-auto flex max-w-[210mm] flex-wrap justify-end gap-3 print:hidden">
      <a href={cvHref[lang]} download className={`${button} bg-vsc-accent text-white hover:bg-[#026ec1]`}>
        <span aria-hidden>↓</span>
        {t.downloadPdf}
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className={`${button} border border-vsc-border bg-vsc-sidebar text-vsc-heading hover:border-vsc-accent`}
      >
        {t.printCv}
      </button>
    </div>
  )
}
