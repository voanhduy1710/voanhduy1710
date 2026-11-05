import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import { SidebarWidthBoot } from '@/components/shell/SidebarWidthBoot'
import { Shell } from '@/components/shell/Shell'
import { loadCertificateNumbers } from '@/lib/certificateManifest'
import { loadContent } from '@/lib/content'
import { LANGS } from '@/lib/content/types'
import { isLang, SITE_URL } from '@/lib/i18n/paths'
import { buildNav } from '@/lib/nav'
import { buildPreloadPlan } from '@/lib/preload/plan'
import { withAnalyses } from '@/lib/projectAnalyses'
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
  // The analytics project's analyses (from its own README) become the BI rows, each with its own page.
  const projects = withAnalyses(lang, content.projects)
  const nav = buildNav(lang, projects, content.certifications, loadCertificateNumbers(), content.cvHref[lang])
  const covers = new Map<string, string>(projects.flatMap((p) => (p.analyses ?? []).flatMap((a) => (a.cover ? [[`${p.slug}/${a.slug}`, a.cover] as const] : []))))
  const preload = buildPreloadPlan(nav, (key) => covers.get(key) ?? (key.includes('/') ? undefined : readmeCoverUrl(key)))
  return (
    // suppressHydrationWarning: the explorer-width boot script (SidebarWidthBoot) may set a style on <html> before hydration.
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <body className="font-sans">
        <SidebarWidthBoot />
        <Shell lang={lang} nav={nav} header={content.header} cvHref={content.cvHref[lang]} preload={preload}>
          {children}
        </Shell>
      </body>
    </html>
  )
}
