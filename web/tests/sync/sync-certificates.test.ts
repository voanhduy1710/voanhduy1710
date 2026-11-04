import { describe, expect, it } from 'vitest'
import {
  CERTIFICATES_JSDELIVR_BASE,
  CERTIFICATES_JSDELIVR_LIST_URL,
  CERTIFICATES_LIST_URL,
  CERTIFICATES_RAW_BASE,
  fetchCertificates,
  jsdelivrListingNames,
} from '../../scripts/sync-certificates'

const README = `# x

<!-- section: certifications -->
## Certifications

| № | Certificate | Status |
|---|---|---|
| 1 | [Alpha](https://example.com/alpha) | Completed |
| 2 | Beta | In progress |

<!-- /section -->
`
const FILES: Record<string, string> = { '1. Alpha.pdf': '%PDF- 1', '2. Beta.pdf': '%PDF- 2' }
const githubListing = JSON.stringify(Object.keys(FILES).map((name) => ({ name, type: 'file' })))
const jsdelivrListing = JSON.stringify({
  type: 'gh',
  files: [...Object.keys(FILES).map((name) => ({ name: `/${name}` })), { name: '/sub/3. Nested.pdf' }],
})

type Reply = number | 'network' | undefined
/**
 * A fake fetch for the four sources. `replies` maps a source (`github`, `jsdelivr-list`, `raw`, `cdn`) to an HTTP
 * status or `network` (a thrown error); unlisted sources answer 200 with the fixture data.
 */
function fake(replies: Partial<Record<'github' | 'jsdelivr-list' | 'raw' | 'cdn', Reply>> = {}) {
  const calls: { url: string; headers: Headers }[] = []
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, headers: new Headers(init?.headers) })
    const [source, body] =
      url === CERTIFICATES_LIST_URL
        ? (['github', githubListing] as const)
        : url === CERTIFICATES_JSDELIVR_LIST_URL
          ? (['jsdelivr-list', jsdelivrListing] as const)
          : url.startsWith(CERTIFICATES_RAW_BASE)
            ? (['raw', FILES[decodeURIComponent(url.slice(CERTIFICATES_RAW_BASE.length))]] as const)
            : url.startsWith(CERTIFICATES_JSDELIVR_BASE)
              ? (['cdn', FILES[decodeURIComponent(url.slice(CERTIFICATES_JSDELIVR_BASE.length))]] as const)
              : (['other', undefined] as const)
    const reply = source === 'other' ? 599 : replies[source]
    if (reply === 'network') throw new Error('getaddrinfo ENOTFOUND')
    if (reply !== undefined) return new Response('error', { status: reply })
    return body === undefined ? new Response('Not Found', { status: 404 }) : new Response(body)
  }) as typeof fetch
  return { impl, calls, urls: () => calls.map((c) => c.url) }
}

const text = (pdfs: { no: number; data: Buffer }[]) => pdfs.map((p) => [p.no, p.data.toString('utf8')])

describe('fetchCertificates sources', () => {
  it('GitHub API + raw when they work; no token means no Authorization header', async () => {
    const f = fake()
    expect(text(await fetchCertificates(README, 'README.md', f.impl, ''))).toEqual([
      [1, '%PDF- 1'],
      [2, '%PDF- 2'],
    ])
    expect(f.urls()).toEqual([
      CERTIFICATES_LIST_URL,
      `${CERTIFICATES_RAW_BASE}1.%20Alpha.pdf`,
      `${CERTIFICATES_RAW_BASE}2.%20Beta.pdf`,
    ])
    for (const c of f.calls) expect(c.headers.has('Authorization')).toBe(false)
  })

  it('GITHUB_TOKEN is sent as a bearer token to the GitHub API only', async () => {
    const f = fake()
    await fetchCertificates(README, 'README.md', f.impl, 'ghp_test_token')
    expect(f.calls[0].headers.get('Authorization')).toBe('Bearer ghp_test_token')
    for (const c of f.calls.slice(1)) expect(c.headers.has('Authorization')).toBe(false)
  })

  it('a 403, 429 or network error from the GitHub API falls back to the jsDelivr listing', async () => {
    for (const reply of [403, 429, 'network'] as const) {
      const f = fake({ github: reply })
      expect(text(await fetchCertificates(README, 'README.md', f.impl, ''))).toEqual([
        [1, '%PDF- 1'],
        [2, '%PDF- 2'],
      ])
      expect(f.urls().slice(0, 2)).toEqual([CERTIFICATES_LIST_URL, CERTIFICATES_JSDELIVR_LIST_URL])
    }
  })

  it('a failing raw download falls back to the jsDelivr CDN', async () => {
    const f = fake({ raw: 'network' })
    expect(text(await fetchCertificates(README, 'README.md', f.impl, ''))).toEqual([
      [1, '%PDF- 1'],
      [2, '%PDF- 2'],
    ])
    expect(f.urls()).toContain(`${CERTIFICATES_JSDELIVR_BASE}1.%20Alpha.pdf`)
    expect(f.urls()).toContain(`${CERTIFICATES_JSDELIVR_BASE}2.%20Beta.pdf`)
  })

  it('fails loudly, naming each attempt, only when every listing source fails', async () => {
    const f = fake({ github: 403, 'jsdelivr-list': 'network' })
    await expect(fetchCertificates(README, 'README.md', f.impl, '')).rejects.toThrow(
      /^Cannot fetch the file list of voanhduy1710\/Certifications: GitHub returned HTTP 403 \(https:\/\/api\.github\.com\/.*\); jsDelivr returned network error: getaddrinfo ENOTFOUND \(https:\/\/data\.jsdelivr\.com\/.*\)$/,
    )
  })

  it('fails loudly, naming each attempt, only when every source of a PDF fails', async () => {
    const f = fake({ raw: 404, cdn: 503 })
    await expect(fetchCertificates(README, 'README.md', f.impl, '')).rejects.toThrow(
      /Cannot fetch voanhduy1710\/Certifications\/1\. Alpha\.pdf: GitHub raw returned HTTP 404 .*; jsDelivr returned HTTP 503 /,
    )
  })

  it('an unreadable GitHub listing also falls back to jsDelivr', async () => {
    const impl = (async (input: string | URL | Request) => {
      const url = String(input)
      if (url === CERTIFICATES_LIST_URL) return new Response('{"message":"not an array"}')
      return fake().impl(input)
    }) as typeof fetch
    expect(text(await fetchCertificates(README, 'README.md', impl, ''))).toHaveLength(2)
  })
})

describe('fetchCertificates content checks', () => {
  it('a 2xx reply that is not a PDF counts as a failed source: the next source is tried', async () => {
    const impl = (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.startsWith(CERTIFICATES_RAW_BASE)) return new Response('<html>rate limited</html>')
      return fake().impl(input)
    }) as typeof fetch
    expect(text(await fetchCertificates(README, 'README.md', impl, ''))).toEqual([
      [1, '%PDF- 1'],
      [2, '%PDF- 2'],
    ])
  })

  it('fails naming both attempts when no source serves a PDF', async () => {
    const impl = (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.startsWith(CERTIFICATES_RAW_BASE) || url.startsWith(CERTIFICATES_JSDELIVR_BASE)) return new Response('')
      return fake().impl(input)
    }) as typeof fetch
    await expect(fetchCertificates(README, 'README.md', impl, '')).rejects.toThrow(
      /GitHub raw gave an unreadable reply: the body is not a PDF .*; jsDelivr gave an unreadable reply: the body is not a PDF/,
    )
  })

  it('a completed certificate missing from a jsDelivr listing says that listing can lag behind GitHub', async () => {
    const lagging = JSON.stringify({ files: [{ name: '/2. Beta.pdf' }] })
    const impl = (async (input: string | URL | Request) => {
      const url = String(input)
      if (url === CERTIFICATES_LIST_URL) return new Response('limit', { status: 403 })
      if (url === CERTIFICATES_JSDELIVR_LIST_URL) return new Response(lagging)
      return fake().impl(input)
    }) as typeof fetch
    await expect(fetchCertificates(README, 'README.md', impl, '')).rejects.toThrow(
      /№ 1 Alpha \(the file list came from jsDelivr .*can lag behind GitHub by hours/,
    )
  })

  it('the same gap in the GitHub listing has no jsDelivr note', async () => {
    const impl = (async (input: string | URL | Request) => {
      if (String(input) === CERTIFICATES_LIST_URL) return new Response(JSON.stringify([{ name: '2. Beta.pdf', type: 'file' }]))
      return fake().impl(input)
    }) as typeof fetch
    const err = await fetchCertificates(README, 'README.md', impl, '').catch((e: Error) => e)
    expect(String(err)).toMatch(/№ 1 Alpha$/)
  })
})

describe('jsdelivrListingNames', () => {
  it('keeps top-level files without the leading slash', () => {
    expect(jsdelivrListingNames(JSON.parse(jsdelivrListing))).toEqual(['1. Alpha.pdf', '2. Beta.pdf'])
    expect(() => jsdelivrListingNames({})).toThrow(/no files array/)
  })
})
