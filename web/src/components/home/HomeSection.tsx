import type { ReactNode } from 'react'
import type { HomeSectionId } from '@/lib/sections'
import { RevealOnView } from './RevealOnView'
import { SECTION_ICONS } from './sectionIcons'

/**
 * One section of the home page: a heading row (the section's icon with a soft coloured glow behind it, then the h2
 * title), then the content. `id` is the scroll target of the explorer's "About Me" sub-items.
 */
export function HomeSection({ id, title, children }: { id: HomeSectionId; title: string; children: ReactNode }) {
  const icon = SECTION_ICONS[id]
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="pt-16">
      <RevealOnView className="section-reveal flex items-center gap-4">
        {icon && (
          <span data-section-icon={icon.name} className="relative isolate inline-flex shrink-0 text-vsc-heading">
            <span
              aria-hidden
              className="section-glow absolute -inset-2 -z-10 rounded-full"
              style={{ backgroundColor: icon.glow }}
            />
            <icon.Icon />
          </span>
        )}
        <h2 id={`${id}-title`} className="text-3xl font-semibold tracking-tight text-vsc-heading">
          {title}
        </h2>
      </RevealOnView>
      {children}
    </section>
  )
}
