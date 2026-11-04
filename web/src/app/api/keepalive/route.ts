/**
 * `GET /api/keepalive`: called once a day by Vercel Cron (see vercel.json) so the free Supabase project is not
 * paused for inactivity. Requires `Authorization: Bearer $CRON_SECRET` (Vercel sends it automatically when the
 * project has CRON_SECRET set); without CRON_SECRET configured every call is refused. Makes one tiny read
 * (`contact_messages?select=id&limit=1`, with the server's secret key) and never returns any of its data.
 *
 * Answers: 200 `{ok:true}`; 401 `unauthorized`; 503 `not_configured` (no SUPABASE_SECRET_KEY); 502 `supabase_failed`.
 * Logs carry outcome codes only, never a key.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import { supabaseBaseUrl } from '@/lib/supabase'


function reply(status: number, body: Record<string, unknown>, outcome: string): Response {
  console.info(`keepalive: ${outcome}`)
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

const sha256 = (s: string) => createHash('sha256').update(s).digest()

/**
 * Constant-time comparison of the Authorization header with `Bearer <secret>`. Both sides are hashed first, so the
 * compared buffers always have the same length and the time taken does not reveal the secret's length.
 */
function authorized(header: string | null, secret: string): boolean {
  return timingSafeEqual(sha256(header ?? ''), sha256(`Bearer ${secret}`))
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || !authorized(request.headers.get('authorization'), secret)) {
    return reply(401, { error: 'unauthorized' }, secret ? 'unauthorized' : 'unauthorized (CRON_SECRET not set)')
  }
  const key = process.env.SUPABASE_SECRET_KEY?.trim()
  if (!key) return reply(503, { error: 'not_configured' }, 'not_configured')
  const base = supabaseBaseUrl()
  try {
    const res = await fetch(`${base}/rest/v1/contact_messages?select=id&limit=1`, { headers: { apikey: key } })
    if (!res.ok) return reply(502, { error: 'supabase_failed' }, `supabase_failed (${res.status})`)
  } catch {
    return reply(502, { error: 'supabase_failed' }, 'supabase_failed (network)')
  }
  return reply(200, { ok: true }, 'ok')
}
