import { Inline } from '@/components/Inline'
import type { SiteContent } from '@/lib/content'
import { HomeSection } from './HomeSection'

/** Experience as a vertical timeline, newest first (README order). */
export function ExperienceSection({ title, experience }: { title: string; experience: SiteContent['experience'] }) {
  return (
    <HomeSection id="experience" title={title}>
      <ol className="mt-10 ml-2 max-w-4xl border-l border-vsc-border">
        {experience.map((e, i) => (
          <li key={`${e.company}-${e.period}`} className="relative pb-10 pl-7 last:pb-0">
            <span
              aria-hidden
              className={`absolute top-2 -left-[0.3125rem] h-2.5 w-2.5 rounded-full ${i === 0 ? 'bg-vsc-accent' : 'bg-vsc-muted'}`}
            />
            <h3 className="text-xl font-semibold text-vsc-heading">{e.company}</h3>
            <p className="mt-1 text-base text-[#4fc1ff]">{e.role}</p>
            <p className="mt-1 font-mono text-xs text-vsc-muted">
              {e.period}
              {e.location && ` · ${e.location}`}
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed marker:text-vsc-muted">
              {e.bullets.map((b, j) => (
                <li
                  key={j}
                  className="[overflow-wrap:anywhere] sm:text-justify sm:[hyphens:auto] sm:[text-justify:inter-word]"
                >
                  <Inline nodes={b} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </HomeSection>
  )
}
