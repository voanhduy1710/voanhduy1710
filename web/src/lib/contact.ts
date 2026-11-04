/**
 * Contact form: the pure checks behind `POST /api/contact` (no I/O here, so all of it is unit-tested).
 *
 * Spam layers, in the order the route applies them:
 *   1. honeypot: a hidden `website` field that people never fill; a filled one is answered "ok" but not sent;
 *   2. time trap: `elapsedMs` (how long the form was open, measured on the visitor's own monotonic clock, so a skewed
 *      system clock does not matter) must be 3 s to 24 h;
 *   3. content checks: field lengths, a simple email check, at most 2 links, no CR/LF in one-line fields;
 *   4. rate limit: at most 3 sends per 10 minutes per client IP (see `createRateLimiter`).
 * A Cloudflare Turnstile check can be added later as a fifth layer (see the TODO in the route).
 */

export const CONTACT_LIMITS = {
  name: 100,
  company: 120,
  email: 254,
  messageMin: 10,
  messageMax: 2000,
  maxLinks: 2,
  minFillMs: 3000,
  maxAgeMs: 24 * 60 * 60 * 1000,
} as const

export const RATE_LIMIT = { max: 3, windowMs: 10 * 60 * 1000 } as const

export type ContactMessage = { name: string; email: string; company: string; message: string; lang: 'en' | 'vi' }

export type ContactError = 'invalid' | 'too_fast' | 'stale' | 'too_many_links'

export type ContactCheck =
  | { kind: 'send'; data: ContactMessage }
  /** The honeypot was filled: answer as if it was sent, but send nothing. */
  | { kind: 'honeypot' }
  | { kind: 'reject'; error: ContactError }

/** Simple RFC-ish address check: one `@`, no spaces or brackets, a dot in the domain, a 2+ letter TLD. */
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:".]+(\.[^\s@<>()[\]\\,;:".]+)*\.[^\s@<>()[\]\\,;:".]{2,}$/
/** C0 controls except tab and line feed, plus DEL and the C1 range. */
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g
const LINK = /\bhttps?:\/\/|\bwww\./gi

/** Removes control characters (keeping tab and newline; CRLF / CR become LF). */
export function stripControl(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(CONTROL, '')
}

/** How many links (`http://`, `https://`, `www.`) a text contains. */
export function countLinks(s: string): number {
  return s.match(LINK)?.length ?? 0
}

/**
 * Length in Unicode code points, as Postgres `char_length` counts (an emoji is 1, not the 2 UTF-16 units of
 * `.length`), so the limits here match the database's checks exactly.
 */
export function charLength(s: string): number {
  return [...s].length
}

export function isEmail(s: string): boolean {
  return s.length <= CONTACT_LIMITS.email && EMAIL.test(s)
}

/** A one-line field: undefined if it is not a string or carries CR / LF (header injection). */
function oneLine(v: unknown): string | undefined {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string' || /[\r\n]/.test(v)) return undefined
  return stripControl(v).trim()
}

/** Checks a parsed JSON body. */
export function checkContact(body: unknown): ContactCheck {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { kind: 'reject', error: 'invalid' }
  const b = body as Record<string, unknown>

  if (typeof b.website === 'string' ? b.website.trim() !== '' : b.website != null) return { kind: 'honeypot' }

  const age = typeof b.elapsedMs === 'number' ? b.elapsedMs : Number.NaN
  if (!Number.isFinite(age)) return { kind: 'reject', error: 'invalid' }
  if (age < CONTACT_LIMITS.minFillMs) return { kind: 'reject', error: 'too_fast' }
  if (age > CONTACT_LIMITS.maxAgeMs) return { kind: 'reject', error: 'stale' }

  const name = oneLine(b.name)
  const email = oneLine(b.email)
  const company = oneLine(b.company)
  const message = typeof b.message === 'string' ? stripControl(b.message).trim() : undefined
  if (name === undefined || email === undefined || company === undefined || message === undefined) {
    return { kind: 'reject', error: 'invalid' }
  }
  if (name === '' || charLength(name) > CONTACT_LIMITS.name) return { kind: 'reject', error: 'invalid' }
  if (charLength(company) > CONTACT_LIMITS.company) return { kind: 'reject', error: 'invalid' }
  if (!isEmail(email)) return { kind: 'reject', error: 'invalid' }
  const messageLength = charLength(message)
  if (messageLength < CONTACT_LIMITS.messageMin || messageLength > CONTACT_LIMITS.messageMax) {
    return { kind: 'reject', error: 'invalid' }
  }
  if (countLinks(message) > CONTACT_LIMITS.maxLinks) return { kind: 'reject', error: 'too_many_links' }

  const lang = b.lang === 'vi' ? 'vi' : 'en'
  return { kind: 'send', data: { name, email, company, message, lang } }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export const DEFAULT_CONTACT_TO = 'voanhduy1710@gmail.com'
export const DEFAULT_CONTACT_FROM = 'Portfolio <onboarding@resend.dev>'

/** The JSON body for Resend's `POST /emails`. Every visitor value in the HTML part is escaped. */
export function buildEmail(m: ContactMessage, opts: { to: string; from: string }) {
  const subject = `Portfolio contact: ${m.name}${m.company ? ` (${m.company})` : ''}`
  const rows: [string, string][] = [
    ['Name', m.name],
    ['Email', m.email],
    ['Company', m.company || '-'],
    ['Page language', m.lang],
  ]
  const text = `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${m.message}\n`
  const html =
    `<table cellpadding="4" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">` +
    rows.map(([k, v]) => `<tr><th align="left">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('') +
    `</table><p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(m.message)}</p>`
  return { from: opts.from, to: [opts.to], subject, text, html, reply_to: m.email }
}

/**
 * The client's IP for the rate limit, from headers a client cannot forge behind Vercel: `x-vercel-forwarded-for`
 * (set by Vercel's edge), then `x-real-ip`, then the LAST `x-forwarded-for` hop (the one the nearest proxy appended;
 * earlier hops are whatever the client sent), else `unknown`. Without a trusted proxy in front (e.g. a bare
 * `next start`), every one of these headers comes from the client, so the limit is only reliable on Vercel.
 */
export function clientIp(headers: Headers): string {
  const first = (name: string) => headers.get(name)?.split(',')[0]?.trim()
  const lastForwarded = headers.get('x-forwarded-for')?.split(',').map((h) => h.trim()).filter(Boolean).pop()
  return first('x-vercel-forwarded-for') || first('x-real-ip') || lastForwarded || 'unknown'
}

/**
 * Sliding-window rate limit kept in memory. Best effort: each server instance (each warm serverless function on
 * Vercel) has its own window, and a cold start empties it, so the real limit across instances can be higher.
 */
export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number } = RATE_LIMIT) {
  const hits = new Map<string, number[]>()
  return {
    /**
     * Reserves a send for `key` at `now` and returns true, or returns false (nothing recorded) if over the limit.
     * Reserving before the send keeps parallel requests from all slipping under the limit; a send that then fails
     * gives its slot back with `refund`.
     */
    take(key: string, now: number): boolean {
      // Drop keys whose window has passed, so the map does not grow with every visitor.
      for (const [k, times] of hits) if (times[times.length - 1] <= now - windowMs) hits.delete(k)
      const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs)
      if (recent.length >= max) {
        hits.set(key, recent)
        return false
      }
      recent.push(now)
      hits.set(key, recent)
      return true
    },
    /** Gives back the slot `take(key, at)` reserved (for a send that failed), so failures do not count. */
    refund(key: string, at: number): void {
      const times = hits.get(key)
      const i = times?.lastIndexOf(at) ?? -1
      if (!times || i < 0) return
      times.splice(i, 1)
      if (times.length === 0) hits.delete(key)
    },
  }
}
