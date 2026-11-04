import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CertificateView } from '@/components/CertificateView'
import { loadCertificateNumbers } from '@/lib/certificateManifest'
import { certificatePdfUrl } from '@/lib/certificates'
import { loadContent } from '@/lib/content'
import { LANGS } from '@/lib/content/types'
import { isLang, languageAlternates } from '@/lib/i18n/paths'
import { ui } from '@/lib/i18n/ui'

/** The README certifications whose PDF the content sync downloaded (content/certificates.json). */
function withPdf(lang: (typeof LANGS)[number]) {
  const pdfs = loadCertificateNumbers()
  return loadContent(lang).certifications.filter((c) => pdfs.has(c.no))
}

/**
 * One page per language and certificate with a PDF, prerendered. Next passes the parent `[lang]` params when it has
 * them. An unknown lang or number (or one without a PDF) gets notFound(): `dynamicParams = false` is rejected while
 * `cacheComponents` is on.
 */
export async function generateStaticParams({ params }: { params?: { lang?: string } } = {}) {
  const langs = LANGS.filter((l) => params?.lang === undefined || params.lang === l)
  return langs.flatMap((lang) => withPdf(lang).map((c) => ({ lang, no: String(c.no) })))
}

/** Like the project pages: every certificate page is prerendered, so a blocking navigation is fine. */
export const instant = false

function findCertificate(lang: string, no: string) {
  if (!isLang(lang) || !/^[1-9]\d*$/.test(no)) return undefined
  const cert = withPdf(lang).find((c) => c.no === Number(no))
  return cert && { lang, cert }
}

export async function generateMetadata({ params }: PageProps<'/[lang]/certifications/[no]'>): Promise<Metadata> {
  const { lang, no } = await params
  const found = findCertificate(lang, no)
  return found
    ? { title: `${found.cert.name} – ${loadContent(found.lang).header.name}`, alternates: languageAlternates(`/certifications/${no}`) }
    : {}
}

export default async function CertificatePage({ params }: PageProps<'/[lang]/certifications/[no]'>) {
  const { lang: rawLang, no } = await params
  const found = findCertificate(rawLang, no)
  if (!found) notFound()
  const { lang, cert } = found
  const t = ui(lang)
  return (
    <CertificateView
      name={cert.name}
      status={cert.status}
      href={cert.href}
      pdfUrl={certificatePdfUrl(cert.no)}
      fileName={`${cert.name}.pdf`}
      labels={{ openOriginal: t.openOriginal, downloadPdf: t.downloadPdf, pdfFallback: t.pdfFallback, openPdf: t.openPdf }}
    />
  )
}
