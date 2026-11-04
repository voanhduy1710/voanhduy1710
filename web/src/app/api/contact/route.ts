/**
 * `POST /api/contact` (JSON): checks a Contact Me submission, then (1) emails it to the owner through Resend's REST
 * API and (2) saves it in Supabase (`public.contact_messages`, through PostgREST). The only dynamic route of the
 * site; every page stays prerendered.
 *
 * Order: email first, then one insert that records the result in `email_sent`. One database call, and the row
 * says truthfully whether the email went out (insert-then-PATCH would need a second call that can fail on its own).
 *
 * Env:
 *   - `RESEND_API_KEY`; `CONTACT_TO` (default voanhduy1710@gmail.com); `CONTACT_FROM` (default
 *     `Portfolio <onboarding@resend.dev>`).
 *   - `SUPABASE_SECRET_KEY` (server-only secret key; sent as the `apikey` header only: it is not a JWT, so no
 *     Authorization header); `SUPABASE_URL` (default https://sudfxyhjksqjmarwcevp.supabase.co). The table has RLS on
 *     and no policies, so only this secret key can insert.
 *   Either side may be unconfigured; it is then skipped. With neither, the route answers 503 `not_configured` and
 *   the form shows the email fallback.
 *
 * Answers: 200 `{ok:true, emailed, saved}` when at least one of email / save worked (or `{ok:true}` for a filled
 * honeypot, silently dropped); 400 `invalid` / `too_fast` / `stale` / `too_many_links`; 429 `rate_limited`;
 * 502 `send_failed` when every configured side failed (its rate-limit slot is given back); 503 `not_configured`.
 * Logs carry outcome codes only: never a key, and never the visitor's message or address.
 */
import {
  buildEmail,
  checkContact,
  clientIp,
  createRateLimiter,
  DEFAULT_CONTACT_FROM,
  DEFAULT_CONTACT_TO,
  type ContactMessage,
} from '@/lib/contact'
import { supabaseBaseUrl } from '@/lib/supabase'

const RESEND_URL = 'https://api.resend.com/emails'
/** The database allows at most 400 characters (code points); a longer User-Agent is cut. */
const MAX_USER_AGENT = 400
/** The form's JSON is a few KB at most; anything far larger is not a real submission. */
const MAX_BODY = 16 * 1024

/** Per server instance; see createRateLimiter for why this is best effort. */
const limiter = createRateLimiter()

function reply(status: number, body: Record<string, unknown>, outcome: string): Response {
  console.info(`contact: ${outcome}`)
  return Response.json(body, { status })
}

/**
 * TODO(turnstile): hook for a Cloudflare Turnstile check, not enabled (the owner decides later). When enabled,
 * the form sends the widget's token and this verifies it at
 * https://challenges.cloudflare.com/turnstile/v0/siteverify with a TURNSTILE_SECRET_KEY env var.
 */
async function passesChallenge(message: ContactMessage): Promise<boolean> {
  void message
  return true
}

type Outcome = { ok: boolean; log: string }

/** Sends the email; never throws. */
async function sendEmail(apiKey: string, data: ContactMessage): Promise<Outcome> {
  const email = buildEmail(data, {
    to: process.env.CONTACT_TO?.trim() || DEFAULT_CONTACT_TO,
    from: process.env.CONTACT_FROM?.trim() || DEFAULT_CONTACT_FROM,
  })
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(email),
    })
    return res.ok ? { ok: true, log: 'ok' } : { ok: false, log: `failed (resend ${res.status})` }
  } catch {
    return { ok: false, log: 'failed (network)' }
  }
}

/** Inserts the message row (values as checked, not HTML-escaped: they are data); never throws. */
async function saveMessage(secretKey: string, data: ContactMessage, userAgent: string, emailSent: boolean): Promise<Outcome> {
  const base = supabaseBaseUrl()
  const row = {
    name: data.name,
    email: data.email,
    company: data.company || null,
    message: data.message,
    lang: data.lang,
    // Cut by code points (never inside a surrogate pair), matching Postgres char_length.
    user_agent: [...userAgent].slice(0, MAX_USER_AGENT).join('') || null,
    email_sent: emailSent,
  }
  try {
    const res = await fetch(`${base}/rest/v1/contact_messages`, {
      method: 'POST',
      headers: { apikey: secretKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    })
    return res.ok ? { ok: true, log: 'ok' } : { ok: false, log: `failed (db ${res.status})` }
  } catch {
    return { ok: false, log: 'failed (db network)' }
  }
}

const SKIPPED: Outcome = { ok: false, log: 'skipped' }

export async function POST(request: Request): Promise<Response> {
  const resendKey = process.env.RESEND_API_KEY?.trim()
  const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim()
  if (!resendKey && !supabaseKey) return reply(503, { error: 'not_configured' }, 'not_configured')

  const raw = await request.text().catch(() => '')
  if (raw.length > MAX_BODY) return reply(400, { error: 'invalid' }, 'invalid (body too large)')
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return reply(400, { error: 'invalid' }, 'invalid (not JSON)')
  }

  const check = checkContact(body)
  if (check.kind === 'honeypot') return reply(200, { ok: true }, 'honeypot (dropped)')
  if (check.kind === 'reject') return reply(400, { error: check.error }, check.error)
  if (!(await passesChallenge(check.data))) return reply(400, { error: 'invalid' }, 'challenge_failed')

  const ip = clientIp(request.headers)
  const reservedAt = Date.now()
  if (!limiter.take(ip, reservedAt)) return reply(429, { error: 'rate_limited' }, 'rate_limited')

  const emailed = resendKey ? await sendEmail(resendKey, check.data) : SKIPPED
  const saved = supabaseKey
    ? await saveMessage(supabaseKey, check.data, request.headers.get('user-agent') ?? '', emailed.ok)
    : SKIPPED
  const log = `email ${emailed.log}, save ${saved.log}`
  if (!emailed.ok && !saved.ok) {
    // Nothing reached the owner: the attempt does not count against the visitor's limit.
    limiter.refund(ip, reservedAt)
    return reply(502, { error: 'send_failed' }, `send_failed (${log})`)
  }
  return reply(200, { ok: true, emailed: emailed.ok, saved: saved.ok }, `delivered (${log})`)
}
