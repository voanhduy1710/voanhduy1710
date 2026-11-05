import type { ReactNode } from 'react'
import { Inline } from '@/components/Inline'
import type { CvContact, CvDegree, CvModel } from '@/lib/cv'
import { ui } from '@/lib/i18n/ui'

/** `https://www.github.com/x/` → `github.com/x`, so the printed CV shows a readable address. */
const displayUrl = (href: string) => href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')

/** The contact line, in this order: phone, email, location, then the web addresses. */
function contactItems(c: CvContact): { key: string; node: ReactNode }[] {
  const out: { key: string; node: ReactNode }[] = []
  if (c.phone) out.push({ key: 'phone', node: c.phone })
  if (c.email) out.push({ key: 'email', node: <a href={`mailto:${c.email}`}>{c.email}</a> })
  if (c.location) out.push({ key: 'location', node: c.location })
  for (const key of ['website', 'github', 'linkedin'] as const) {
    const href = c[key]
    if (href) out.push({ key, node: <a href={href}>{displayUrl(href)}</a> })
  }
  return out
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cv-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function Degree({ d }: { d: CvDegree }) {
  return (
    <>
      <strong>{d.degree}</strong>
      {d.detail && ` (${d.detail})`}
      {d.period && `, ${d.period}`}
      {d.note && <span className="cv-meta"> · {d.note}</span>}
    </>
  )
}

/**
 * The one CV template for both languages: renders a `CvModel` (from `public/cv/cv.{en,vi}.yaml`) as a printable A4 page.
 * ATS-friendly on purpose: one column, real text only (no images), standard section headings from `ui()`.
 * Styled by `app/cv-print.css`; optional sections (projects, certifications, languages) are left out when empty.
 */
export function CvDocument({ cv }: { cv: CvModel }) {
  const t = ui(cv.lang)
  const { name, title, contact, summary, skills, experience, projects, education, certifications, languages } = cv

  return (
    <article className="cv">
      <header className="cv-header">
        <h1>{name}</h1>
        <p className="cv-title">{title}</p>
        <ul className="cv-contact">
          {contactItems(contact).map((c) => (
            <li key={c.key}>{c.node}</li>
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
              <strong>{s.category}:</strong> {s.items.join(', ')}
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

      {projects.length > 0 && (
        <Section title={t.pageProjects}>
          {projects.map((p) => (
            <div key={p.name} className="cv-entry cv-project">
              <div className="cv-entry-head">
                <h3>{p.name}</h3>
                {p.link && (
                  <a className="cv-meta" href={p.link}>
                    {displayUrl(p.link)}
                  </a>
                )}
              </div>
              <p className="cv-line">
                <Inline nodes={p.description} />
              </p>
              <p className="cv-meta cv-tech">{p.tech.join(' · ')}</p>
            </div>
          ))}
        </Section>
      )}

      <Section title={t.education}>
        {education.map((e) => (
          <div key={e.school} className="cv-education">
            <div className="cv-entry-head">
              <h3>{e.school}</h3>
              {e.location && <span className="cv-meta">{e.location}</span>}
            </div>
            <ul className="cv-bullets">
              {e.degrees.map((d, i) => (
                <li key={i}>
                  <Degree d={d} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      {certifications.length > 0 && (
        <Section title={t.certifications}>
          <ul className="cv-columns">
            {certifications.map((c) => (
              <li key={c.name}>
                {c.link ? <a href={c.link}>{c.name}</a> : c.name}
                {c.issuer && ` (${c.issuer})`}
                {` – ${c.status}`}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {languages.length > 0 && (
        <Section title={t.languages}>
          <ul className="cv-columns">
            {languages.map((l) => (
              <li key={l.name}>{`${l.name}: ${l.level}`}</li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  )
}
