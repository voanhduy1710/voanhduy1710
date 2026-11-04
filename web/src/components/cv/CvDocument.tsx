import type { ReactNode } from 'react'
import { Inline } from '@/components/Inline'
import type { SiteContent } from '@/lib/content'
import type { Badge, Inline as InlineNode } from '@/lib/content/types'
import { ui } from '@/lib/i18n/ui'

/** Web addresses only: the README's relative CV-PDF links and `mailto:` (already a contact item) stay off the CV. */
const WEB_LINK = /^https?:\/\//i

/** `https://www.github.com/x/` → `github.com/x`, so the printed CV shows a readable address. */
const displayUrl = (href: string) => href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')

/** Badge alt texts that name no technology. */
const GENERIC_ALT = new Set(['tests'])

/** A project's tech line: badge alt text (else label), generic ones skipped, case-insensitive duplicates dropped. */
function techLine(badges: Badge[]): string {
  const seen = new Set<string>()
  const names: string[] = []
  for (const b of badges) {
    const name = (b.alt || b.label).trim()
    const key = name.toLowerCase()
    if (!name || GENERIC_ALT.has(key) || seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names.join(' · ')
}

/** Drops a trailing `:` (and trailing whitespace) from inline content, e.g. a paragraph that introduces a list. */
function withoutTrailingColon(nodes: InlineNode[]): InlineNode[] {
  const last = nodes[nodes.length - 1]
  if (!last) return nodes
  const head = nodes.slice(0, -1)
  switch (last.kind) {
    case 'text':
      return [...head, { ...last, value: last.value.replace(/\s*:?\s*$/, '') }]
    case 'code':
      return nodes
    default:
      return [...head, { ...last, children: withoutTrailingColon(last.children) }]
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cv-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

/**
 * The README content as a printable A4 CV: name, title, contact line, summary, skills, experience, projects
 * (one line + tech each), education, certifications, languages. No images. Styled by `app/cv-print.css`.
 */
export function CvDocument({ content }: { content: SiteContent }) {
  const t = ui(content.lang)
  const { header, summary, skills, experience, projects, education, certifications, languages, contact } = content
  const webLinks = header.links.filter((l) => WEB_LINK.test(l.href))

  return (
    <article className="cv">
      <header className="cv-header">
        <h1>{header.name}</h1>
        <p className="cv-title">{header.title}</p>
        <ul className="cv-contact">
          {contact.map((c) => (
            <li key={c.label}>
              <Inline nodes={c.value} />
            </li>
          ))}
          {webLinks.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{displayUrl(l.href)}</a>
            </li>
          ))}
        </ul>
      </header>

      <Section title={t.summary}>
        {summary.map((p, i) => (
          <p key={i}>
            <Inline nodes={p} />
          </p>
        ))}
      </Section>

      <Section title={t.pageSkills}>
        <ul className="cv-skills">
          {skills.map((s) => (
            <li key={s.category}>
              <strong>{s.category}:</strong> {s.tools.join(', ')}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.pageExperience}>
        {experience.map((e) => (
          <div key={`${e.company}-${e.period}`} className="cv-entry">
            <div className="cv-entry-head">
              <h3>{e.company}</h3>
              <span className="cv-meta">
                {e.period}
                {e.location && ` · ${e.location}`}
              </span>
            </div>
            <p className="cv-role">{e.role}</p>
            <ul className="cv-bullets">
              {e.bullets.map((b, i) => (
                <li key={i}>
                  <Inline nodes={b} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title={t.pageProjects}>
        {projects.map((p) => {
          const line = p.description[0] ?? p.bullets[0]
          const tech = techLine(p.badges)
          return (
            <div key={p.slug} data-project={p.slug} className="cv-entry cv-project">
              <h3>{p.title}</h3>
              {line && (
                <p className="cv-line">
                  <Inline nodes={withoutTrailingColon(line)} />
                </p>
              )}
              {tech && <p className="cv-meta cv-tech">{tech}</p>}
            </div>
          )
        })}
      </Section>

      <Section title={t.education}>
        {education.map((e) => (
          <div key={e.school} className="cv-education">
            <h3>{e.school}</h3>
            <ul className="cv-bullets">
              {e.degrees.map((d, i) => (
                <li key={i}>
                  <Inline nodes={d.text} />
                  {d.note && <span className="cv-meta"> · {d.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title={t.certifications}>
        <ul className="cv-columns">
          {certifications.map((c) => (
            <li key={c.name}>{`${c.name} – ${c.status}`}</li>
          ))}
        </ul>
      </Section>

      <Section title={t.languages}>
        <ul className="cv-columns">
          {languages.map((l) => (
            <li key={l.name}>{`${l.name}: ${l.level}`}</li>
          ))}
        </ul>
      </Section>
    </article>
  )
}
