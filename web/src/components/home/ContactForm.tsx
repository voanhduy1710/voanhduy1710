'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CONTACT_LIMITS } from '@/lib/contact'

export type ContactFormLabels = {
  title: string
  name: string
  email: string
  company: string
  message: string
  optional: string
  namePlaceholder: string
  emailPlaceholder: string
  companyPlaceholder: string
  messagePlaceholder: string
  send: string
  sending: string
  sent: string
  error: string
  invalid: string
  tooFast: string
  stale: string
  rateLimited: string
  fallback: string
  orEmail: string
}

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'invalid' | 'tooFast' | 'stale' | 'rateLimited' | 'fallback'

const field =
  'w-full rounded border border-vsc-border bg-vsc-sidebar/80 px-3 py-2 text-sm text-vsc-heading placeholder:text-vsc-muted focus:border-vsc-accent focus:outline-none'
const label = 'mb-1.5 block text-sm text-vsc-heading'

/** Maps the route's answer to what the form shows. */
function statusOf(res: Response, error: unknown): Status {
  if (res.ok) return 'sent'
  if (res.status === 503) return 'fallback'
  if (res.status === 429) return 'rateLimited'
  if (res.status === 400) return error === 'too_fast' ? 'tooFast' : error === 'stale' ? 'stale' : 'invalid'
  return 'error'
}

/**
 * Contact Me form: posts JSON to /api/contact, which emails the owner. Carries a hidden `website` honeypot and how
 * long the form has been open (`elapsedMs`, from `performance.now()`, so a visitor's skewed clock does not matter);
 * see src/lib/contact.ts for the server's checks. If the site has no email
 * key configured, or sending fails, it offers the owner's address instead.
 */
export function ContactForm({ lang, labels, email }: { lang: string; labels: ContactFormLabels; email?: string }) {
  const mountedAt = useRef(0)
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    mountedAt.current = performance.now()
  }, [])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    const data = new FormData(formEl)
    const text = (k: string) => String(data.get(k) ?? '')
    setStatus('sending')
    let next: Status
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: text('name'),
          email: text('email'),
          company: text('company'),
          message: text('message'),
          website: text('website'),
          elapsedMs: Math.round(performance.now() - mountedAt.current),
          lang,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: unknown }
      next = statusOf(res, body.error)
    } catch {
      next = 'error'
    }
    if (next === 'sent') formEl.reset()
    setStatus(next)
  }

  const sending = status === 'sending'
  const message = {
    idle: '',
    sending: labels.sending,
    sent: labels.sent,
    error: labels.error,
    invalid: labels.invalid,
    tooFast: labels.tooFast,
    stale: labels.stale,
    rateLimited: labels.rateLimited,
    fallback: labels.fallback,
  }[status]
  const offerEmail = email && (status === 'fallback' || status === 'error' || status === 'rateLimited')
  const tone = status === 'sent' ? 'text-vsc-teal' : status === 'sending' ? 'text-vsc-muted' : 'text-[#f48771]'

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={label}>
            {labels.name} <span aria-hidden className="text-vsc-muted">*</span>
          </label>
          <input id="contact-name" name="name" required maxLength={CONTACT_LIMITS.name} autoComplete="name" placeholder={labels.namePlaceholder} className={field} />
        </div>
        <div>
          <label htmlFor="contact-email" className={label}>
            {labels.email} <span aria-hidden className="text-vsc-muted">*</span>
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={CONTACT_LIMITS.email}
            autoComplete="email"
            placeholder={labels.emailPlaceholder}
            className={field}
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-company" className={label}>
          {labels.company} <span className="text-vsc-muted">({labels.optional})</span>
        </label>
        <input
          id="contact-company"
          name="company"
          maxLength={CONTACT_LIMITS.company}
          autoComplete="organization"
          placeholder={labels.companyPlaceholder}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="contact-message" className={label}>
          {labels.message} <span aria-hidden className="text-vsc-muted">*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={CONTACT_LIMITS.messageMin}
          maxLength={CONTACT_LIMITS.messageMax}
          rows={6}
          placeholder={labels.messagePlaceholder}
          className={`${field} resize-y`}
        />
      </div>
      {/* Honeypot: hidden from people (off-screen, out of the tab order, hidden from screen readers); bots fill it. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center rounded bg-vsc-accent px-5 py-2 text-sm font-medium text-white hover:bg-[#1f8ad2] disabled:opacity-60"
        >
          {sending ? labels.sending : labels.send}
        </button>
        <p role="status" aria-live="polite" className={`min-w-0 flex-1 text-sm ${tone}`}>
          {status !== 'sending' && message}
          {offerEmail && (
            <>
              {status === 'fallback' ? ' ' : ` ${labels.orEmail} `}
              <a href={`mailto:${email}`} className="text-vsc-link underline">
                {email}
              </a>
            </>
          )}
        </p>
      </div>
    </form>
  )
}
