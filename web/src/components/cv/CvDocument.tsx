import type { CvHtml } from '@/lib/cv/html'

/**
 * The CV sheet: the content of `<main class="cv">` of `public/cv/CV_EN.html` / `CV_VN.html` (hand-edited by the owner),
 * styled by `public/cv/cv.css` — the same files export_cv.ps1 prints to the PDFs, so the page and the PDFs never
 * differ. Rendered as <article class="cv"> because the site shell already has a <main>. One accent colour
 * (`--cv-accent`, Pine by default; the signed-in owner's colour picker overrides it on <html>). ONE A4 page:
 * `npm run check:cv` / export_cv.ps1 enforce it.
 */
export function CvDocument({ cv }: { cv: CvHtml }) {
  return <article className="cv" lang={cv.lang} dangerouslySetInnerHTML={{ __html: cv.body }} />
}
