import Image from 'next/image'
import { PageSection } from '@/components/PageSection'
import type { SiteContent } from '@/lib/content'
import { assetUrl } from '@/lib/content/assets'
import { HomeSection } from './HomeSection'

/** Skills: tech-stack logo grid, then the README's skills table (№ | Category | Tech & Tools). */
export function SkillsSection({
  labels,
  techStack,
  skills,
}: {
  labels: { title: string; techStack: string; skillsMatrix: string; no: string; category: string; tools: string }
  techStack: SiteContent['techStack']
  skills: SiteContent['skills']
}) {
  return (
    <HomeSection id="skills" title={labels.title}>
      <PageSection title={labels.techStack} heading="h3">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {techStack.map((tech) => (
            <li
              key={tech.logo}
              className="flex items-center gap-3 rounded border border-vsc-border bg-vsc-sidebar/80 px-3 py-2.5 text-sm"
            >
              {/*
                The README's logos are large PNGs (up to 156 KB each, ~1 MB in all) shown about 34 px high. A plain
                eager <img> also made React preload every one of them in <head>, ahead of the page's JavaScript.
                next/image serves a resized WebP (48 / 96 px wide) and loads it lazily, near the Skills section.
              */}
              <Image
                src={assetUrl(tech.logo)}
                alt=""
                // Logos vary in aspect ratio and CSS sets the shown size, so the intrinsic size is set larger than any
                // rendered size (Next warns when only one dimension matches its attribute); `sizes` keeps the 48/96 px files.
                width={96}
                height={96}
                sizes="48px"
                loading="lazy"
                className="h-7 w-10 shrink-0 object-contain object-left"
              />
              {tech.name}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection title={labels.skillsMatrix} heading="h3">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm leading-6 text-[#cccccc]">
            <thead>
              <tr className="border-b border-[#4a4a4a]">
                <th scope="col" className="w-10 py-2 pr-4 font-semibold text-vsc-heading">
                  {labels.no}
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold text-vsc-heading">
                  {labels.category}
                </th>
                <th scope="col" className="py-2 font-semibold text-vsc-heading">
                  {labels.tools}
                </th>
              </tr>
            </thead>
            <tbody>
              {skills.map((row, i) => (
                <tr key={row.category} className="border-b border-vsc-border/70 align-top last:border-b-0">
                  <td className="py-2.5 pr-4 tabular-nums text-vsc-muted">{i + 1}</td>
                  <th scope="row" className="py-2.5 pr-4 font-semibold text-vsc-heading sm:whitespace-nowrap">
                    {row.category}
                  </th>
                  <td className="py-2.5">{row.tools.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>
    </HomeSection>
  )
}
