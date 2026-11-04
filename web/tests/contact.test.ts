import { describe, expect, it } from 'vitest'
import {
  buildEmail,
  checkContact,
  clientIp,
  countLinks,
  createRateLimiter,
  escapeHtml,
  isEmail,
  stripControl,
} from '@/lib/contact'

const valid = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  company: 'Acme',
  message: 'Hello, I would like to talk about a role.',
  website: '',
  elapsedMs: 10_000,
  lang: 'vi',
}

describe('checkContact', () => {
  it('accepts a valid submission and trims the fields', () => {
    expect(checkContact({ ...valid, name: '  Jane Doe ' })).toEqual({
      kind: 'send',
      data: { name: 'Jane Doe', email: 'jane@example.com', company: 'Acme', message: valid.message, lang: 'vi' },
    })
  })

  it('company is optional; an unknown lang becomes en', () => {
    const r = checkContact({ ...valid, company: undefined, lang: 'fr' })
    expect(r).toMatchObject({ kind: 'send', data: { company: '', lang: 'en' } })
  })

  it('honeypot: a filled `website` is dropped quietly, before any other check', () => {
    expect(checkContact({ ...valid, website: 'http://spam.example' })).toEqual({ kind: 'honeypot' })
    expect(checkContact({ website: 'x', elapsedMs: 0 })).toEqual({ kind: 'honeypot' })
    expect(checkContact({ ...valid, website: '   ' }).kind).toBe('send')
  })

  it('time trap: elapsedMs under 3 s is too_fast, over 24 h is stale, missing or not a number is invalid', () => {
    expect(checkContact({ ...valid, elapsedMs: 2999 })).toEqual({ kind: 'reject', error: 'too_fast' })
    expect(checkContact({ ...valid, elapsedMs: 3000 }).kind).toBe('send')
    expect(checkContact({ ...valid, elapsedMs: -5000 })).toEqual({ kind: 'reject', error: 'too_fast' })
    expect(checkContact({ ...valid, elapsedMs: 24 * 3600_000 }).kind).toBe('send')
    expect(checkContact({ ...valid, elapsedMs: 24 * 3600_000 + 1 })).toEqual({ kind: 'reject', error: 'stale' })
    expect(checkContact({ ...valid, elapsedMs: '123' })).toEqual({ kind: 'reject', error: 'invalid' })
    expect(checkContact({ ...valid, elapsedMs: undefined })).toEqual({ kind: 'reject', error: 'invalid' })
    expect(checkContact({ ...valid, elapsedMs: Number.NaN })).toEqual({ kind: 'reject', error: 'invalid' })
  })

  it('time trap ignores the absolute clock: an old absolute `startedAt` alone is not accepted', () => {
    expect(checkContact({ ...valid, elapsedMs: undefined, startedAt: Date.now() - 10_000 })).toEqual({ kind: 'reject', error: 'invalid' })
  })

  it('length limits: name 1-100, company <= 120, email <= 254, message 10-2000', () => {
    const bad = (patch: Record<string, unknown>) => checkContact({ ...valid, ...patch })
    expect(bad({ name: 'n'.repeat(100) }).kind).toBe('send')
    expect(bad({ name: 'n'.repeat(101) })).toEqual({ kind: 'reject', error: 'invalid' })
    expect(bad({ name: '   ' })).toEqual({ kind: 'reject', error: 'invalid' })
    expect(bad({ company: 'c'.repeat(120) }).kind).toBe('send')
    expect(bad({ company: 'c'.repeat(121) })).toEqual({ kind: 'reject', error: 'invalid' })
    expect(bad({ email: `${'a'.repeat(243)}@example.com` })).toEqual({ kind: 'reject', error: 'invalid' })
    expect(bad({ message: 'too short' })).toEqual({ kind: 'reject', error: 'invalid' })
    expect(bad({ message: 'm'.repeat(10) }).kind).toBe('send')
    expect(bad({ message: 'm'.repeat(2000) }).kind).toBe('send')
    expect(bad({ message: 'm'.repeat(2001) })).toEqual({ kind: 'reject', error: 'invalid' })
  })

  it('lengths count code points like Postgres char_length: an emoji is one character', () => {
    const emoji = '\u{1F600}' // 2 UTF-16 units
    // 5 emoji = 10 UTF-16 units but 5 characters: too short for the database's minimum of 10.
    expect(checkContact({ ...valid, message: emoji.repeat(5) })).toEqual({ kind: 'reject', error: 'invalid' })
    expect(checkContact({ ...valid, message: emoji.repeat(10) }).kind).toBe('send')
    // 2000 emoji = 4000 UTF-16 units, still 2000 characters: allowed; 2001 is not.
    expect(checkContact({ ...valid, message: emoji.repeat(2000) }).kind).toBe('send')
    expect(checkContact({ ...valid, message: emoji.repeat(2001) })).toEqual({ kind: 'reject', error: 'invalid' })
    expect(checkContact({ ...valid, name: emoji.repeat(100) }).kind).toBe('send')
    expect(checkContact({ ...valid, name: emoji.repeat(101) })).toEqual({ kind: 'reject', error: 'invalid' })
    expect(checkContact({ ...valid, company: emoji.repeat(120) }).kind).toBe('send')
    expect(checkContact({ ...valid, company: emoji.repeat(121) })).toEqual({ kind: 'reject', error: 'invalid' })
  })

  it('more than 2 links in the message is too_many_links', () => {
    const two = 'See https://a.example and www.b.example please.'
    expect(checkContact({ ...valid, message: two }).kind).toBe('send')
    expect(checkContact({ ...valid, message: `${two} Also http://c.example` })).toEqual({
      kind: 'reject',
      error: 'too_many_links',
    })
  })

  it('rejects CR / LF in one-line fields (header injection) and non-string fields', () => {
    for (const patch of [
      { name: 'Jane\r\nBcc: x@evil.example' },
      { email: 'jane@example.com\nBcc: x@evil.example' },
      { company: 'Acme\rX' },
      { name: 42 },
      { message: ['x'] },
    ]) {
      expect(checkContact({ ...valid, ...patch })).toEqual({ kind: 'reject', error: 'invalid' })
    }
  })

  it('strips control characters from every field but keeps the message line breaks', () => {
    const r = checkContact({ ...valid, name: 'Ja\u0000ne\u0007', message: 'Line one\r\nLine\u001b two\ttab' })
    expect(r).toMatchObject({ kind: 'send', data: { name: 'Jane', message: 'Line one\nLine two\ttab' } })
  })

  it('rejects a body that is not an object', () => {
    for (const body of [null, 'x', [valid], 3]) expect(checkContact(body)).toEqual({ kind: 'reject', error: 'invalid' })
  })
})

describe('helpers', () => {
  it('isEmail: simple RFC-ish check', () => {
    for (const ok of ['a@b.co', 'first.last+tag@sub.example.com.vn']) expect(isEmail(ok)).toBe(true)
    for (const bad of ['', 'a', 'a@b', 'a@b.c', 'a b@c.com', 'a@@b.com', '<a@b.com>', 'a@b..com', 'a@.com']) {
      expect(isEmail(bad)).toBe(false)
    }
  })

  it('countLinks counts http(s):// and www.', () => {
    expect(countLinks('no links here')).toBe(0)
    expect(countLinks('HTTPS://a.b http://c.d www.e.f')).toBe(3)
  })

  it('stripControl and escapeHtml', () => {
    expect(stripControl('a\u0000b\u007fc\u0085d\re')).toBe('abcd\ne')
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;',
    )
  })

  it('clientIp: x-vercel-forwarded-for, then x-real-ip, then the LAST x-forwarded-for hop, then unknown', () => {
    const ip = (h: Record<string, string>) => clientIp(new Headers(h))
    expect(ip({ 'x-vercel-forwarded-for': '203.0.113.7', 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' })).toBe('203.0.113.7')
    expect(ip({ 'x-real-ip': ' 198.51.100.2 ', 'x-forwarded-for': '9.9.9.9' })).toBe('198.51.100.2')
    // A client-forged first hop is ignored: the proxy-appended last hop is used.
    expect(ip({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1 , 192.0.2.5' })).toBe('192.0.2.5')
    expect(ip({ 'x-forwarded-for': '192.0.2.5,' })).toBe('192.0.2.5')
    expect(ip({})).toBe('unknown')
  })
})

describe('buildEmail', () => {
  const msg = { name: 'Jane <b>', email: 'jane@example.com', company: 'A&B', message: 'Hi <img src=x onerror=alert(1)>\nthere', lang: 'en' as const }

  it('subject, recipients, reply_to and a text body with every field', () => {
    const e = buildEmail(msg, { to: 'owner@example.com', from: 'Portfolio <onboarding@resend.dev>' })
    expect(e.subject).toBe('Portfolio contact: Jane <b> (A&B)')
    expect(e.to).toEqual(['owner@example.com'])
    expect(e.from).toBe('Portfolio <onboarding@resend.dev>')
    expect(e.reply_to).toBe('jane@example.com')
    expect(e.text).toContain('Name: Jane <b>\nEmail: jane@example.com\nCompany: A&B\nPage language: en')
    expect(e.text).toContain(msg.message)
  })

  it('escapes every visitor value in the HTML body', () => {
    const { html } = buildEmail(msg, { to: 't@example.com', from: 'f@example.com' })
    expect(html).not.toContain('<b>')
    expect(html).not.toContain('<img')
    expect(html).toContain('Jane &lt;b&gt;')
    expect(html).toContain('A&amp;B')
    expect(html).toContain('Hi &lt;img src=x onerror=alert(1)&gt;')
  })

  it('leaves the company out of the subject when there is none', () => {
    expect(buildEmail({ ...msg, company: '' }, { to: 't@x.co', from: 'f@x.co' }).subject).toBe('Portfolio contact: Jane <b>')
  })
})

describe('createRateLimiter', () => {
  it('allows 3 per 10 minutes per key, as a sliding window', () => {
    const rl = createRateLimiter()
    const t0 = 1_000_000
    expect([rl.take('a', t0), rl.take('a', t0 + 1000), rl.take('a', t0 + 2000)]).toEqual([true, true, true])
    expect(rl.take('a', t0 + 3000)).toBe(false)
    expect(rl.take('b', t0 + 3000)).toBe(true)
    // The first hit leaves the window at t0 + 10 min; a refused attempt is not recorded.
    expect(rl.take('a', t0 + 600_000 - 1)).toBe(false)
    expect(rl.take('a', t0 + 600_000)).toBe(true)
    expect(rl.take('a', t0 + 600_500)).toBe(false)
    expect(rl.take('a', t0 + 601_000)).toBe(true)
  })

  it('refund gives a reserved slot back; refunding an unknown slot is a no-op', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000 })
    expect(rl.take('a', 10)).toBe(true)
    expect(rl.take('a', 20)).toBe(false)
    rl.refund('a', 10)
    expect(rl.take('a', 30)).toBe(true)
    rl.refund('a', 999)
    rl.refund('nobody', 30)
    expect(rl.take('a', 40)).toBe(false)
  })
})
