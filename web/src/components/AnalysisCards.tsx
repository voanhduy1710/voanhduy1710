import Image from 'next/image'
import Link from 'next/link'
import type { Lang } from '@/lib/content/types'
import { ui } from '@/lib/i18n/ui'
import type { Analysis } from '@/lib/projectAnalyses'

/** Href of an analysis page. */
export const analysisHref = (lang: Lang, project: string, analysis: string) => `/${lang}/projects/${project}/${analysis}`

/**
 * The analytics project's overview: one card per analysis (its first image, number, title, skills line), each linking
 * to the analysis page, in README order.
 */
export function AnalysisCards({ lang, project, analyses }: { lang: Lang; project: string; analyses: readonly Analysis[] }) {
  const t = ui(lang)
  return (
    <ul data-analyses className="mt-4 grid list-none gap-4 p-0 sm:grid-cols-2">
      {analyses.map((a) => (
        <li key={a.slug} className="m-0 p-0">
          <Link
            href={analysisHref(lang, project, a.slug)}
            prefetch
            className="group flex h-full flex-col overflow-hidden rounded-md border border-vsc-border bg-vsc-sidebar/80 transition-colors hover:border-vsc-accent focus-visible:border-vsc-accent"
          >
            <div className="relative aspect-[16/9] overflow-hidden border-b border-vsc-border bg-black/30">
              {a.cover ? (
                <Image
                  src={a.cover}
                  alt=""
                  fill
                  loading="lazy"
                  sizes="(min-width: 1024px) 420px, (min-width: 640px) 45vw, 100vw"
                  className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
                />
              ) : (
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#252526_0%,#1a2733_100%)]" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-4">
              <h3 className="m-0 text-base font-semibold text-vsc-heading group-hover:text-white">
                <span className="mr-1.5 font-mono text-sm text-vsc-muted">{a.number}.</span>
                {a.title}
              </h3>
              {a.summary && <p className="m-0 line-clamp-2 text-sm leading-relaxed text-vsc-text">{a.summary}</p>}
              {a.powerBiUrl && <p className="m-0 mt-auto pt-1 text-xs text-[#f2c811]">{t.dashboardBadge}</p>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
