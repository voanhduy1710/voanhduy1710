import { Inline } from '@/components/Inline'
import { PageSection } from '@/components/PageSection'
import type { SiteContent } from '@/lib/content'
import { ContactForm, type ContactFormLabels } from './ContactForm'
import { HomeSection } from './HomeSection'

/** Contact: the README's contact items and header links, then the Contact Me form (emails the owner). */
export function ContactSection({
  lang,
  labels,
  formLabels,
  contact,
  links,
}: {
  lang: string
  labels: { title: string; links: string }
  formLabels: ContactFormLabels
  contact: SiteContent['contact']
  links: SiteContent['header']['links']
}) {
  // The form's fallback address is the README's own mailto link.
  const email = links.find((l) => /^mailto:/i.test(l.href))?.href.replace(/^mailto:/i, '').split('?')[0]
  // The email address is already in the contact items above, so the Links row leaves its mailto link out.
  const linkChips = links.filter((l) => !/^mailto:/i.test(l.href))
  return (
    <HomeSection id="contact" title={labels.title}>
      <div className="max-w-3xl">
        {/* The section's own h2 already says "Contact", so the items follow it without a second heading. */}
        <dl className="mt-8 divide-y divide-vsc-border rounded-md border border-vsc-border bg-vsc-sidebar/80">
          {contact.map((c) => (
            <div key={c.label} className="grid gap-1 px-5 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="font-mono text-sm text-vsc-muted">{c.label}</dt>
              <dd className="min-w-0 break-words">
                <Inline nodes={c.value} />
              </dd>
            </div>
          ))}
        </dl>

        {linkChips.length > 0 && (
          <PageSection title={labels.links} heading="h3">
            <ul className="flex flex-wrap gap-3">
              {linkChips.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded border border-vsc-border bg-vsc-sidebar/80 px-4 py-2 text-vsc-link hover:border-vsc-accent hover:underline"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </PageSection>
        )}

        <PageSection title={formLabels.title} heading="h3">
          <ContactForm lang={lang} labels={formLabels} email={email} />
        </PageSection>
      </div>
    </HomeSection>
  )
}
