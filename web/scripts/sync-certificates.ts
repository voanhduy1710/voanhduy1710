/**
 * Certificate PDFs for the content sync: lists the public repo voanhduy1710/Certifications once, keeps the files
 * named `<no>. <anything>.pdf` whose number is a certificate in the README's Certifications table, and downloads
 * them. Every README certificate whose status is "Completed" must have one; a certificate that is not completed
 * yet may lack it. Same in local and github content modes (that repo is never local).
 *
 * Sources, so a rate-limited GitHub API (60 requests/hour per IP unauthenticated; Vercel build IPs are shared)
 * does not break the build:
 *   - listing: the GitHub contents API (with `Authorization: Bearer $GITHUB_TOKEN` when that env var is set; the
 *     token is never logged), then jsDelivr's flat package listing if GitHub fails (any HTTP error or network error);
 *   - each PDF: raw.githubusercontent.com, then the jsDelivr CDN; a 2xx reply that is not a PDF (`%PDF-` header)
 *     counts as a failed source.
 * Only when every source of a step fails does the sync fail, naming each attempt.
 */
import { findSection } from '../src/lib/content/markers'
import { parseCertifications } from '../src/lib/content/parse/certifications'
import { isCompleted } from '../src/lib/certificates'

export const CERTIFICATES_REPO = 'voanhduy1710/Certifications'
export const CERTIFICATES_LIST_URL = `https://api.github.com/repos/${CERTIFICATES_REPO}/contents/?ref=main`
export const CERTIFICATES_RAW_BASE = `https://raw.githubusercontent.com/${CERTIFICATES_REPO}/main/`
export const CERTIFICATES_JSDELIVR_LIST_URL = `https://data.jsdelivr.com/v1/packages/gh/${CERTIFICATES_REPO}@main?structure=flat`
export const CERTIFICATES_JSDELIVR_BASE = `https://cdn.jsdelivr.net/gh/${CERTIFICATES_REPO}@main/`
/** GitHub's API rejects requests without a User-Agent. */
const HEADERS = { 'User-Agent': 'voanhduy1710-portfolio-sync', Accept: 'application/vnd.github+json' }
const PDF_NAME = /^(\d+)\.\s.*\.pdf$/

export type CertificatePdf = { no: number; name: string; data: Buffer }

/** `{ no, name }` of every numbered PDF among the repo's top-level file names; fails on two with the same number. */
export function numberedPdfs(names: readonly string[]): { no: number; name: string }[] {
  const out: { no: number; name: string }[] = []
  for (const name of names) {
    const m = PDF_NAME.exec(name)
    if (!m) continue
    const no = Number(m[1])
    const twin = out.find((p) => p.no === no)
    if (twin) throw new Error(`${CERTIFICATES_REPO} has two PDFs numbered ${no}: "${twin.name}" and "${name}"`)
    out.push({ no, name })
  }
  return out
}

/** Top-level file names of a GitHub contents API listing. */
export function githubListingNames(listing: unknown): string[] {
  if (!Array.isArray(listing)) throw new Error('the listing is not an array')
  return (listing as { name?: unknown; type?: unknown }[])
    .filter((e) => e?.type === 'file' && typeof e.name === 'string')
    .map((e) => e.name as string)
}

/** Top-level file names of a jsDelivr flat listing (`files: [{ name: "/1. x.pdf" }, …]`). */
export function jsdelivrListingNames(listing: unknown): string[] {
  const files = (listing as { files?: unknown } | null)?.files
  if (!Array.isArray(files)) throw new Error('the listing has no files array')
  return (files as { name?: unknown }[])
    .map((f) => (typeof f?.name === 'string' ? f.name.replace(/^\//, '') : ''))
    .filter((n) => n !== '' && !n.includes('/'))
}

/**
 * How long one request (headers and body) may take before it is abandoned, so a stalled source fails like any other
 * and the next source is tried instead of the build hanging.
 */
export const FETCH_TIMEOUT_MS = 30_000

/** One fetch attempt: the response if it is 200-299, else a short reason (`HTTP 403`, `network error: …`). */
export async function attempt(fetchImpl: typeof fetch, url: string, headers: Record<string, string>): Promise<Response | string> {
  try {
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    return res.ok ? res : `HTTP ${res.status}`
  } catch (e) {
    return `network error: ${(e as Error).message}`
  }
}

export type Source<T> = { label: string; url: string; headers: Record<string, string>; read: (res: Response) => Promise<T> }

/** Tries each source in turn; throws naming every failed attempt if none works. */
export async function firstWorking<T>(fetchImpl: typeof fetch, what: string, sources: Source<T>[]): Promise<T> {
  const failures: string[] = []
  for (const src of sources) {
    const res = await attempt(fetchImpl, src.url, src.headers)
    if (typeof res === 'string') {
      failures.push(`${src.label} returned ${res} (${src.url})`)
      continue
    }
    try {
      return await src.read(res)
    } catch (e) {
      failures.push(`${src.label} gave an unreadable reply: ${(e as Error).message} (${src.url})`)
    }
  }
  throw new Error(`Cannot fetch ${what}: ${failures.join('; ')}`)
}

export type CertificateListing = { names: string[]; source: 'GitHub' | 'jsDelivr' }

/** The repo's top-level file names and where they came from: GitHub API first, jsDelivr if that fails. */
export async function listCertificateFiles(
  fetchImpl: typeof fetch,
  token = process.env.GITHUB_TOKEN?.trim(),
): Promise<CertificateListing> {
  const github = token ? { ...HEADERS, Authorization: `Bearer ${token}` } : HEADERS
  return firstWorking<CertificateListing>(fetchImpl, `the file list of ${CERTIFICATES_REPO}`, [
    {
      label: 'GitHub',
      url: CERTIFICATES_LIST_URL,
      headers: github,
      read: async (r) => ({ names: githubListingNames(await r.json()), source: 'GitHub' }),
    },
    {
      label: 'jsDelivr',
      url: CERTIFICATES_JSDELIVR_LIST_URL,
      headers: HEADERS,
      read: async (r) => ({ names: jsdelivrListingNames(await r.json()), source: 'jsDelivr' }),
    },
  ])
}

/** The bytes of a reply that must be a PDF; a 2xx error page, HTML or empty body is an unreadable reply. */
async function pdfBytes(r: Response): Promise<Buffer> {
  const data = Buffer.from(await r.arrayBuffer())
  if (data.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('the body is not a PDF (no %PDF- header)')
  return data
}

/** One PDF's bytes: raw.githubusercontent.com first, the jsDelivr CDN if that fails or does not serve a PDF. */
async function downloadCertificate(fetchImpl: typeof fetch, name: string): Promise<Buffer> {
  const path = encodeURIComponent(name)
  const read = pdfBytes
  return firstWorking(fetchImpl, `${CERTIFICATES_REPO}/${name}`, [
    { label: 'GitHub raw', url: CERTIFICATES_RAW_BASE + path, headers: HEADERS, read },
    { label: 'jsDelivr', url: CERTIFICATES_JSDELIVR_BASE + path, headers: HEADERS, read },
  ])
}

/**
 * Downloads the certificate PDFs for the certifications in `readme` (the EN README's text). A README without a
 * Certifications section needs none (the full parse at build time reports the missing section).
 */
export async function fetchCertificates(
  readme: string,
  readmeFile: string,
  fetchImpl: typeof fetch,
  token?: string,
): Promise<CertificatePdf[]> {
  const section = findSection(readme, 'certifications')
  const certs = section === undefined ? [] : parseCertifications(section, readmeFile)
  const listing = await listCertificateFiles(fetchImpl, token)
  const pdfs = numberedPdfs(listing.names)
  const missing = certs.filter((c) => isCompleted(c.status) && !pdfs.some((p) => p.no === c.no))
  if (missing.length > 0) {
    const list = missing.map((c) => `№ ${c.no} ${c.name}`).join(', ')
    const lag =
      listing.source === 'jsDelivr'
        ? ' (the file list came from jsDelivr because the GitHub API failed; jsDelivr can lag behind GitHub by hours, so a PDF pushed recently may not be listed yet: retry later or set GITHUB_TOKEN)'
        : ''
    throw new Error(`${readmeFile} lists completed certificates with no "<№>. ….pdf" in ${CERTIFICATES_REPO}: ${list}${lag}`)
  }
  const wanted = pdfs.filter((p) => certs.some((c) => c.no === p.no))
  return Promise.all(wanted.map(async ({ no, name }) => ({ no, name, data: await downloadCertificate(fetchImpl, name) })))
}
