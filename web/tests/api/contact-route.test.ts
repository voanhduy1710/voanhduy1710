import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/contact/route'

const RESEND_KEY = 're_test_not_a_real_key'
const SUPABASE_KEY = 'sb_secret_test_not_a_real_key'
const RESEND_URL = 'https://api.resend.com/emails'
const DB_URL = 'https://sudfxyhjksqjmarwcevp.supabase.co/rest/v1/contact_messages'
const MESSAGE = 'Hello, I would like to talk about a role. <b>bold</b> & more'
let ipCounter = 0
let logs: string[] = []

/** Each request gets its own IP unless one is given, so the module-level rate limiter does not leak between tests. */
function request(body: unknown, ip = `203.0.113.${++ipCounter}`, userAgent = 'TestAgent/1.0'): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, 'user-agent': userAgent },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function form(patch: Record<string, unknown> = {}) {
  return { name: 'Jane', email: 'jane@example.com', company: 'Acme', message: MESSAGE, website: '', elapsedMs: 10_000, lang: 'en', ...patch }
}

type Reply = number | 'network'
/** Fake fetch for Resend and Supabase: each answers 200 / the given status, or throws for `network`. */
function services({ resend = 200, db = 201 }: { resend?: Reply; db?: Reply } = {}) {
  const spy = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    void init
    const url = String(input)
    const reply = url === RESEND_URL ? resend : url === DB_URL ? db : 599
    if (reply === 'network') throw new Error('offline')
    return reply < 300 ? Response.json(url === RESEND_URL ? { id: 'email_1' } : {}, { status: reply }) : new Response('error', { status: reply })
  })
  vi.stubGlobal('fetch', spy)
  const callsTo = (url: string) => spy.mock.calls.filter(([u]) => String(u) === url) as unknown as [string, RequestInit][]
  return { spy, resendCalls: () => callsTo(RESEND_URL), dbCalls: () => callsTo(DB_URL) }
}

function configure({ resend = true, db = true }: { resend?: boolean; db?: boolean } = {}) {
  vi.stubEnv('RESEND_API_KEY', resend ? RESEND_KEY : '')
  vi.stubEnv('SUPABASE_SECRET_KEY', db ? SUPABASE_KEY : '')
}

beforeEach(() => {
  logs = []
  vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => void logs.push(args.join(' ')))
  vi.stubEnv('CONTACT_TO', '')
  vi.stubEnv('CONTACT_FROM', '')
  vi.stubEnv('SUPABASE_URL', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function expectNoSecretsInLogs() {
  const all = logs.join('\n')
  for (const secret of [RESEND_KEY, SUPABASE_KEY, MESSAGE, 'jane@example.com']) expect(all).not.toContain(secret)
}

describe('POST /api/contact: configuration', () => {
  it('503 not_configured when neither RESEND_API_KEY nor SUPABASE_SECRET_KEY is set, without any request', async () => {
    configure({ resend: false, db: false })
    const s = services()
    const res = await POST(request(form()))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not_configured' })
    expect(s.spy).not.toHaveBeenCalled()
  })

  it('only Resend configured: emails, skips the database', async () => {
    configure({ db: false })
    const s = services()
    const res = await POST(request(form()))
    expect(await res.json()).toEqual({ ok: true, emailed: true, saved: false })
    expect(s.dbCalls()).toHaveLength(0)
  })

  it('only Supabase configured: saves (email_sent false), skips Resend', async () => {
    configure({ resend: false })
    const s = services()
    const res = await POST(request(form()))
    expect(await res.json()).toEqual({ ok: true, emailed: false, saved: true })
    expect(s.resendCalls()).toHaveLength(0)
    expect(JSON.parse(s.dbCalls()[0][1].body as string).email_sent).toBe(false)
  })
})

describe('POST /api/contact: email + save', () => {
  beforeEach(() => configure())

  it('both ok: emails first, then inserts the raw values with email_sent true; apikey header only', async () => {
    const s = services()
    const res = await POST(request(form()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, emailed: true, saved: true })
    expect(s.spy.mock.calls.map(([u]) => String(u))).toEqual([RESEND_URL, DB_URL])

    const [, resendInit] = s.resendCalls()[0]
    expect((resendInit.headers as Record<string, string>).Authorization).toBe(`Bearer ${RESEND_KEY}`)
    expect(JSON.parse(resendInit.body as string)).toMatchObject({
      from: 'Portfolio <onboarding@resend.dev>',
      to: ['voanhduy1710@gmail.com'],
      subject: 'Portfolio contact: Jane (Acme)',
      reply_to: 'jane@example.com',
    })

    const [, dbInit] = s.dbCalls()[0]
    expect(dbInit.method).toBe('POST')
    expect(dbInit.headers).toEqual({ apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' })
    expect(JSON.parse(dbInit.body as string)).toEqual({
      name: 'Jane',
      email: 'jane@example.com',
      company: 'Acme',
      message: MESSAGE, // stored raw, not HTML-escaped
      lang: 'en',
      user_agent: 'TestAgent/1.0',
      email_sent: true,
    })
    expect(logs).toEqual(['contact: delivered (email ok, save ok)'])
    expectNoSecretsInLogs()
  })

  it('db fails, email ok: 200 emailed only', async () => {
    services({ db: 500 })
    const res = await POST(request(form()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, emailed: true, saved: false })
    expect(logs).toEqual(['contact: delivered (email ok, save failed (db 500))'])
  })

  it('db ok, email fails (e.g. a bad Resend key): 200 saved only, the row says email_sent false', async () => {
    const s = services({ resend: 401 })
    const res = await POST(request(form()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, emailed: false, saved: true })
    expect(JSON.parse(s.dbCalls()[0][1].body as string).email_sent).toBe(false)
    expect(logs).toEqual(['contact: delivered (email failed (resend 401), save ok)'])
  })

  it('both fail (HTTP or network): 502 send_failed', async () => {
    for (const replies of [{ resend: 403, db: 500 }, { resend: 'network', db: 'network' }] as const) {
      services(replies)
      const res = await POST(request(form()))
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ error: 'send_failed' })
    }
    expect(logs).toEqual([
      'contact: send_failed (email failed (resend 403), save failed (db 500))',
      'contact: send_failed (email failed (network), save failed (db network))',
    ])
    expectNoSecretsInLogs()
  })

  it('uses CONTACT_TO, CONTACT_FROM and SUPABASE_URL (trailing slash trimmed) when set; empty company is null', async () => {
    vi.stubEnv('CONTACT_TO', 'owner@example.com')
    vi.stubEnv('CONTACT_FROM', 'Site <hi@example.com>')
    vi.stubEnv('SUPABASE_URL', 'https://other.supabase.co/')
    const s = services()
    await POST(request(form({ company: '' })))
    const sent = JSON.parse(s.resendCalls()[0][1].body as string)
    expect(sent.to).toEqual(['owner@example.com'])
    expect(sent.from).toBe('Site <hi@example.com>')
    const [dbUrl, dbInit] = s.spy.mock.calls[1] as unknown as [string, RequestInit]
    expect(dbUrl).toBe('https://other.supabase.co/rest/v1/contact_messages')
    expect(JSON.parse(dbInit.body as string).company).toBeNull()
  })

  it('a User-Agent over 400 characters is cut to the database limit of 400 (code points)', async () => {
    const s = services()
    await POST(request(form(), undefined, `Mozilla/5.0 ${'x'.repeat(438)}`))
    const ua = JSON.parse(s.dbCalls()[0][1].body as string).user_agent as string
    expect(ua).toHaveLength(400)
    expect(ua.startsWith('Mozilla/5.0 x')).toBe(true)
  })

  it('honeypot: 200 ok, nothing sent or saved', async () => {
    const s = services()
    const res = await POST(request(form({ website: 'https://spam.example' })))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(s.spy).not.toHaveBeenCalled()
  })

  it('400 with the reason for too fast, stale, too many links, bad fields and non-JSON', async () => {
    const s = services()
    const cases: [unknown, string][] = [
      [form({ elapsedMs: 500 }), 'too_fast'],
      [form({ elapsedMs: 25 * 3600_000 }), 'stale'],
      [form({ message: 'a http://a.b b http://c.d c http://e.f' }), 'too_many_links'],
      [form({ email: 'not-an-email' }), 'invalid'],
      [form({ name: 'Jane\r\nBcc: x@evil.example' }), 'invalid'],
      ['{not json', 'invalid'],
      [JSON.stringify({ ...form(), message: 'x'.repeat(20_000) }), 'invalid'],
    ]
    for (const [body, error] of cases) {
      const res = await POST(request(body))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error })
    }
    expect(s.spy).not.toHaveBeenCalled()
  })

  it('429 after 3 deliveries from one IP in 10 minutes; another IP still gets through', async () => {
    services()
    const ip = '198.51.100.77'
    const statuses = []
    for (let i = 0; i < 4; i++) statuses.push((await POST(request(form(), ip))).status)
    expect(statuses).toEqual([200, 200, 200, 429])
    expect((await POST(request(form()))).status).toBe(200)
  })

  it('the slot is given back only when both sides failed; a half success counts', async () => {
    const ip = '198.51.100.88'
    services({ resend: 401, db: 500 })
    for (let i = 0; i < 3; i++) expect((await POST(request(form(), ip))).status).toBe(502)
    services({ resend: 'network', db: 'network' })
    for (let i = 0; i < 3; i++) expect((await POST(request(form(), ip))).status).toBe(502)
    // Email fails but the save works: delivered, and it counts.
    services({ resend: 401 })
    const statuses = []
    for (let i = 0; i < 4; i++) statuses.push((await POST(request(form(), ip))).status)
    expect(statuses).toEqual([200, 200, 200, 429])
  })

  it('a forged first x-forwarded-for hop does not dodge the limit (the last hop is the key)', async () => {
    services()
    const statuses = []
    for (let i = 0; i < 4; i++) statuses.push((await POST(request(form(), `10.0.${i}.1, 198.51.100.99`))).status)
    expect(statuses).toEqual([200, 200, 200, 429])
  })
})
