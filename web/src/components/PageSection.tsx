import type { ReactNode } from 'react'

/**
 * A titled block of an editor page: a bold heading (UI font) over a rule, with an optional link on the right.
 * `heading` is the element level (h3 inside a home-page section, whose title is the h2).
 */
export function PageSection({
  id,
  title,
  action,
  heading: Heading = 'h2',
  children,
}: {
  id?: string
  title: string
  action?: ReactNode
  heading?: 'h2' | 'h3'
  children: ReactNode
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-6">
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-vsc-border pb-2">
        <Heading className="text-base font-bold text-vsc-heading">{title}</Heading>
        {action}
      </div>
      {children}
    </section>
  )
}
