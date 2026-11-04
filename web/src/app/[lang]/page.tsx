import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContactSection } from '@/components/home/ContactSection'
import { ExperienceSection } from '@/components/home/ExperienceSection'
import { MatrixHand } from '@/components/home/MatrixHand'
import { ProjectsSection } from '@/components/home/ProjectsSection'
import { SkillsSection } from '@/components/home/SkillsSection'
import { Inline } from '@/components/Inline'
import { DoubleChevronDownIcon, DownloadIcon, GitHubMarkIcon } from '@/components/shell/icons'
import { SectionLink } from '@/components/shell/SectionLink'
import { SectionSpy } from '@/components/shell/SectionSpy'
import { TypingRoles } from '@/components/TypingRoles'
import { loadContent } from '@/lib/content'
import { isLang, languageAlternates } from '@/lib/i18n/paths'
import { ui } from '@/lib/i18n/ui'

export async function generateMetadata({ params }: PageProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params
  if (!isLang(lang)) return {}
  return { title: `${ui(lang).pageHome} – ${loadContent(lang).header.name}`, alternates: languageAlternates('') }
}

/**
 * Home ("About Me" tab): one scrolling page of sections, in explorer order. `about` is the hero (name,
 * `● status / typing roles`, summary, GitHub + Download CV + Contact Me, scroll chevron), then `experience`,
 * `skills`, `projects` (the cards grid) and `contact`. The explorer's sub-items scroll to them; <SectionSpy>
 * highlights the one in view.
 */
export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params
  if (!isLang(lang)) notFound()
  const t = ui(lang)
  const { header, summary, techStack, skills, projects, experience, contact, cvHref } = loadContent(lang)
  const github = header.links.find((l) => /^https?:\/\/(www\.)?github\.com\//i.test(l.href))

  return (
    <article>
      {/* Hero: fills the editor pane, left-aligned and vertically centred like the mockup. */}
      <section id="about" aria-label={t.navAbout} className="relative flex min-h-[calc(100dvh-var(--ui-titlebar)-var(--ui-tab)-var(--ui-statusbar))] flex-col justify-center px-5 py-16 font-ui sm:px-[9vw]">
        <h1 className="flex items-center gap-x-[0.3em] text-[clamp(2.167rem,5.4vw,3.667rem)] leading-tight font-normal tracking-[-0.01em] text-[#f2f4fb]">
          <span className="shrink-0">{header.name}</span>
          {/* Decorative waving hand of digital rain (where the wave emoji used to be): 2.8em, capped at 110px on
              narrow screens, and shrinking to the room left beside the name so the row never wraps. */}
          <MatrixHand className="-my-[0.5em] aspect-square h-auto w-[2.8em] min-w-0 max-w-[110px] shrink sm:max-w-none" />
        </h1>
        <p className="mt-[0.4rem] flex flex-wrap items-center gap-x-[0.45rem] text-[0.875rem] text-[#dfe3f2]">
          {header.status && (
            <>
              <span aria-hidden className="size-2 rounded-full bg-[#22c55e] shadow-[0_0_0_3px_rgb(34_197_94/0.18)]" />
              <span>{header.status}</span>
              {header.roles.length > 0 && (
                <span aria-hidden className="text-[#6f7591]">
                  /
                </span>
              )}
            </>
          )}
          {header.roles.length > 0 ? <TypingRoles roles={header.roles} /> : <span className="text-vsc-teal">{header.title}</span>}
        </p>
        <div className="mt-[0.6rem] max-w-[39.6rem] space-y-2 text-[0.85rem] leading-[1.45] text-[#c9cde0]">
          {summary.map((p, i) => (
            <p key={i}>
              <Inline nodes={p} />
            </p>
          ))}
        </div>
        <div className="mt-[1.1rem] flex flex-wrap items-center gap-[0.65rem]">
          {github && (
            <a
              href={github.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={github.label}
              title={github.label}
              className="rounded-full p-[0.25rem] text-[#e3e6f3] hover:text-white"
            >
              <GitHubMarkIcon className="size-[1.15rem]" />
            </a>
          )}
          <a
            href={cvHref[lang]}
            download
            className="inline-flex items-center gap-[0.4rem] rounded-full bg-[#f3f4f8] px-[0.83rem] py-[0.375rem] text-[0.792rem] text-[#14172a] hover:bg-white"
          >
            <DownloadIcon className="size-[0.85em]" />
            {t.downloadCv}
          </a>
          <SectionLink
            lang={lang}
            section="contact"
            className="inline-flex items-center gap-[0.4rem] rounded-full border border-[#3c3c3c] px-[0.83rem] py-[0.375rem] text-[0.792rem] text-[#e3e6f3] hover:bg-vsc-hover"
          >
            {t.navContact} <span aria-hidden>→</span>
          </SectionLink>
        </div>
        <SectionLink
          lang={lang}
          section="experience"
          aria-label={t.scrollDown}
          className="hero-chevron absolute bottom-[1.35rem] left-1/2 -ml-[0.68rem] text-[#8d8d8d] hover:text-white"
        >
          <DoubleChevronDownIcon className="size-[1.35rem]" />
        </SectionLink>
      </section>

      <div className="mx-auto max-w-5xl px-5 pb-24 sm:px-10">
        <ExperienceSection title={t.pageExperience} experience={experience} />
        <SkillsSection labels={{ title: t.pageSkills, techStack: t.techStack, skillsMatrix: t.skillsMatrix, no: t.skillsNo, category: t.skillsCategory, tools: t.skillsTools }} techStack={techStack} skills={skills} />
        <ProjectsSection title={t.pageProjects} lang={lang} projects={projects} />
        <ContactSection
          lang={lang}
          labels={{ title: t.contact, links: t.links }}
          formLabels={{
            title: t.formTitle,
            name: t.formName,
            email: t.formEmail,
            company: t.formCompany,
            message: t.formMessage,
            optional: t.formOptional,
            namePlaceholder: t.formNamePlaceholder,
            emailPlaceholder: t.formEmailPlaceholder,
            companyPlaceholder: t.formCompanyPlaceholder,
            messagePlaceholder: t.formMessagePlaceholder,
            send: t.formSend,
            sending: t.formSending,
            sent: t.formSent,
            error: t.formError,
            invalid: t.formInvalid,
            tooFast: t.formTooFast,
            stale: t.formStale,
            rateLimited: t.formRateLimited,
            fallback: t.formFallback,
            orEmail: t.formOrEmail,
          }}
          contact={contact}
          links={header.links}
        />
      </div>
      <SectionSpy />
    </article>
  )
}
