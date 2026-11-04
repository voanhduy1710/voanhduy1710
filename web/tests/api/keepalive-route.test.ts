import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/keepalive/route'

const SECRET = 'cron_test_secret'
const KEY = 'sb_secret_test_not_a_real_key'
let logs: string[] = []

const call = (auth?: string) =>
  GET(new Request('http://localhost/api/keepalive', { headers: auth === undefined ? {} : { authorization: auth } }))

beforeEach(() => {
  logs = []
  vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => void logs.push(args.join(' ')))
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.stubEnv('SUPABASE_SECRET_KEY', KEY)
  vi.stubEnv('SUPABASE_URL', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/keepalive', () => {
  it('401 without CRON_SECRET configured, even with a header; nothing fetched', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    for (const auth of [undefined, 'Bearer ', 'Bearer undefined']) expect((await call(auth)).status).toBe(401)
    expect(spy).not.toHaveBeenCalled()
  })

  it('401 for a missing or wrong bearer token', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    for (const auth of [undefined, 'Bearer wrong', SECRET, `Bearer ${SECRET}x`]) {
      const res = await call(auth)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthorized' })
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('200 {ok:true} after one tiny Supabase read with the apikey header; no data in the answer', async () => {
    const spy = vi.fn(async () => Response.json([{ id: 'row-1' }]))
    vi.stubGlobal('fetch', spy)
    const res = await call(`Bearer ${SECRET}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(spy).toHaveBeenCalledTimes(1)
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://sudfxyhjksqjmarwcevp.supabase.co/rest/v1/contact_messages?select=id&limit=1')
    expect(init.headers).toEqual({ apikey: KEY })
    expect(logs.join('\n')).not.toContain(KEY)
    expect(logs.join('\n')).not.toContain(SECRET)
  })

  it('502 when Supabase answers an error or is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('paused', { status: 540 })))
    expect((await call(`Bearer ${SECRET}`)).status).toBe(502)
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
    const res = await call(`Bearer ${SECRET}`)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'supabase_failed' })
    expect(logs).toEqual(['keepalive: supabase_failed (540)', 'keepalive: supabase_failed (network)'])
  })

  it('503 not_configured without SUPABASE_SECRET_KEY', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '')
    expect((await call(`Bearer ${SECRET}`)).status).toBe(503)
  })
})
