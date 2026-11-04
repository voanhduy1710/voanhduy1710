import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import { Shell } from '@/components/shell/Shell'
import { loadCertificateNumbers } from '@/lib/certificateManifest'
import { loadContent } from '@/lib/content'
import { LANGS } from '@/lib/content/types'
import { isLang, SITE_URL } from '@/lib/i18n/paths'
import { buildNav } from '@/lib/nav'
import { buildPreloadPlan } from '@/lib/preload/plan'
import { readmeCoverUrl } from '@/lib/projectReadmeManifest'
import '../globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'vietnamese'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin', 'vietnamese'] })

// `dynamicParams = false` is rejected while `cacheComponents` is on; unknown langs get notFound() instead.
export const generateStaticParams = () => LANGS.map((lang) => ({ lang }))

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params
  if (!isLang(lang)) return {}
  const { header } = loadContent(lang)
  return {
    metadataBase: new URL(SITE_URL),
    title: `${header.name} – ${header.title}`,
    description: header.title,
    icons: { icon: [{ url: '/vscode_icon.webp', type: 'image/webp' }], apple: '/vscode_icon.webp' },
  }
}

export default async function LangLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const content = loadContent(lang)
  const nav = buildNav(lang, content.projects, content.certifications, loadCertificateNumbers(), content.cvHref[lang])
  const preload = buildPreloadPlan(nav, readmeCoverUrl)
  return (
    // suppressHydrationWarning: the explorer-width script (Shell) may set a style on <html> before hydration.
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <body className="font-sans">
        <Shell lang={lang} nav={nav} header={content.header} cvHref={content.cvHref[lang]} preload={preload}>
          {children}
        </Shell>
      </body>
    </html>
  )
}
