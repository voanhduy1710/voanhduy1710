import Image from 'next/image'
import Link from 'next/link'
import { BadgeChip } from '@/components/BadgeChip'
import { Inline } from '@/components/Inline'
import type { SiteContent } from '@/lib/content'
import { assetUrl } from '@/lib/content/assets'
import type { Inline as InlineNode, Lang } from '@/lib/content/types'

type CardProject = SiteContent['projects'][number]

/** Links unwrapped to their text: the card itself is a link, and links may not nest. */
function withoutLinks(nodes: InlineNode[]): InlineNode[] {
  return nodes.flatMap((n): InlineNode[] => {
    if (n.kind === 'link') return withoutLinks(n.children)
    if (n.kind === 'strong' || n.kind === 'em') return [{ ...n, children: withoutLinks(n.children) }]
    return [n]
  })
}

/** Shown instead of a screenshot when a project has no previews: the title on an editor-like panel. */
function Placeholder({ title, slug }: { title: string; slug: string }) {
  return (
    <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(135deg,#252526_0%,#1a2733_100%)] p-4">
      <span aria-hidden className="font-mono text-xs text-vsc-muted">
        {slug}.md
      </span>
      <span className="text-lg leading-snug font-semibold text-vsc-heading">{title}</span>
      <span aria-hidden className="space-y-1.5">
        <span className="block h-1.5 w-3/4 rounded bg-white/10" />
        <span className="block h-1.5 w-1/2 rounded bg-white/10" />
      </span>
    </div>
  )
}

/**
 * A project card linking to its detail page (prefetched in production, so the click is instant): first screenshot
 * (or, without one, the first image of the project's own README; else a placeholder), title, note, badges, summary.
 * `eager` loads the screenshot immediately (cards above the fold).
 */
export function ProjectCard({
  project,
  lang,
  eager = false,
  fallbackCover,
}: {
  project: CardProject
  lang: Lang
  eager?: boolean
  /** Served URL used when the profile README has no preview for the project (the first image of its own README). */
  fallbackCover?: string
}) {
  const first = project.images[0]
  const cover = first ? { src: assetUrl(first.src), alt: first.alt || project.title } : fallbackCover && { src: fallbackCover, alt: project.title }
  const summary = project.description[0] ?? project.bullets[0]
  return (
    <Link
      href={`/${lang}/projects/${project.slug}`}
      prefetch
      className="group flex flex-col overflow-hidden rounded-md border border-vsc-border bg-vsc-sidebar/80 transition-colors hover:border-vsc-accent focus-visible:border-vsc-accent"
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-vsc-border bg-black/30">
        {cover ? (
          <Image
            src={cover.src}
            alt={cover.alt}
            fill
            loading={eager ? 'eager' : 'lazy'}
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 45vw, 100vw"
            className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
          />
        ) : (
          <Placeholder title={project.title} slug={project.slug} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold text-vsc-heading group-hover:text-white">{project.title}</h3>
        {project.note && <p className="text-xs text-vsc-muted italic">{project.note}</p>}
        {summary && (
          <p className="line-clamp-3 text-sm leading-relaxed">
            <Inline nodes={withoutLinks(summary)} />
          </p>
        )}
        {project.badges.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {/* The whole card is a link: badges are drawn without their own links here. */}
            {project.badges.map((b, i) => (
              <BadgeChip key={i} badge={{ ...b, href: undefined }} />
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
