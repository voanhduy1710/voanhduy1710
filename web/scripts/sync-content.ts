/**
 * Copies the profile READMEs and every image / PDF they reference into the website's build input:
 * READMEs -> `<outDir>/content/`, assets -> `<outDir>/public/content/<path>` (served by `assetUrl`). The repo-root
 * `.gitignore` (shown read-only in the site's explorer) -> `<outDir>/content/repo-files/gitignore`; it is required.
 * Certificate PDFs (from the voanhduy1710/Certifications repo, in both modes; see sync-certificates.ts) ->
 * `<outDir>/public/content/certificates/<no>.pdf`, their numbers -> `<outDir>/content/certificates.json`.
 * Every project's own README (from each project's repo, in both modes; see sync-project-readmes.ts) ->
 * `<outDir>/content/project-readmes/<slug>.md`, their repo-relative images ->
 * `<outDir>/public/content/project-readmes/<slug>/<repo path>`, both listed in `<outDir>/content/project-readmes.json`;
 * the repo files an analytics project's analyses link to -> `<outDir>/content/project-readmes/<slug>/<repo path>`.
 * Assets under `web/public/` (logos, previews) are already part of the site, so they are only checked
 * to exist (local: in the profile repo; github: in `<outDir>/public/`), never copied.
 * Reads the local profile repo or GitHub raw. Everything is checked and staged first; the live dirs are
 * swapped only after every file succeeded, so a failed sync leaves the previous content untouched.
 *
 * CLI: `CONTENT_SOURCE=local|github` (default github), `PROFILE_REPO_PATH` (default C:\voanhduy1710),
 * `CONTENT_REF` (github mode: branch, tag or commit SHA to read; default `main`). GitHub caches raw `main` for
 * ~5 minutes, so deploy_vercel.ps1 pins the build to the commit SHA of `origin/main`.
 */
import { existsSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { referencedAssets, SITE_PUBLIC_PREFIX } from '../src/lib/content/assets'
import { README_FILES } from '../src/lib/content/index'
import { CERTIFICATES_MANIFEST, certificatePdfPath } from '../src/lib/certificates'
import { SYNCED_REPO_FILES } from '../src/lib/repoFiles'
import { FETCH_TIMEOUT_MS, fetchCertificates } from './sync-certificates'
import { fetchProjectReadmes, type ProjectReadme } from './sync-project-readmes'
import { PROJECT_READMES_DIR, PROJECT_READMES_MANIFEST, readmeFileName, type ProjectReadmeManifest } from '../src/lib/projectReadme/source'
import { isLockedError, renameWithRetry, updateInPlace, withSyncLock, type FsHooks } from './sync-fs'

const GITHUB_RAW_ROOT = 'https://raw.githubusercontent.com/voanhduy1710/voanhduy1710/'
const DEFAULT_CONTENT_REF = 'main'
/** A git branch / tag / SHA: no spaces, no `..`, nothing that would change the URL's meaning. */
const CONTENT_REF_PATTERN = /^(?!.*\.\.)[A-Za-z0-9._/-]+$/

/** Raw-file base URL for a git ref of the profile repo. */
export function githubRawBase(ref: string = DEFAULT_CONTENT_REF): string {
  if (!CONTENT_REF_PATTERN.test(ref)) throw new Error(`CONTENT_REF must be a branch, tag or commit SHA, got "${ref}"`)
  return `${GITHUB_RAW_ROOT}${ref}/`
}

export const GITHUB_RAW_BASE = githubRawBase()
const DEFAULT_PROFILE_REPO_PATH = 'C:\\voanhduy1710'

export interface SyncOptions {
  source: 'local' | 'github'
  profilePath: string
  outDir: string
  /** github mode: branch, tag or commit SHA to read (default `main`). */
  ref?: string
  /** GitHub requests: the profile repo (github mode), the Certifications repo and project repos (both modes). */
  fetchImpl?: typeof fetch
  /** Removes the staging dir; injectable so tests can simulate Windows EBUSY/EPERM. */
  rmImpl?: typeof rm
  /** Rename + retry delay for the swap (tests simulate a folder a running dev server holds). */
  fsHooks?: FsHooks
  /** How long to wait for another sync's lock (default 30 s). */
  lockTimeoutMs?: number
  /** Non-fatal problems (a project README image that cannot be synced); default: a yellow console warning. */
  warn?: (message: string) => void
}

/** Output dirs (relative to outDir) and the staging subdir each is built in. */
const TARGETS = [
  { live: 'content', staged: 'content' },
  { live: join('public', 'content'), staged: 'public-content' },
] as const

/** Normalises a README-relative path; rejects absolute paths and paths escaping the profile repo. */
function safeRelPath(p: string, readme: string): string {
  const norm = posix.normalize(p)
  if (norm.startsWith('/') || /^[a-z]:/i.test(norm) || norm === '..' || norm.startsWith('../')) {
    throw new Error(`${readme} references a path outside the profile repo: ${p}`)
  }
  return norm
}

const NOT_FOUND = 'file not found (names are case-sensitive; check the exact spelling)'

/**
 * True when the `/`-separated `rel` names a file under `root` with exactly this spelling. Each segment is matched
 * against its parent's directory listing, so a case difference (`Mysql.png` vs `MySQL.png`) fails here on Windows and
 * macOS just as it would on the case-sensitive Linux host that serves the site.
 */
export async function existsExact(root: string, rel: string): Promise<boolean> {
  const parts = rel.split('/')
  let dir = root
  for (const [i, part] of parts.entries()) {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return false
    }
    const hit = entries.find((e) => e.name === part)
    if (!hit) return false
    const last = i === parts.length - 1
    if (!hit.isSymbolicLink() && (last ? !hit.isFile() : !hit.isDirectory())) return false
    dir = join(dir, part)
  }
  return true
}

function reader(opts: SyncOptions): (path: string) => Promise<Buffer> {
  if (opts.source === 'local') {
    return async (path) => {
      const abs = join(opts.profilePath, path)
      if (!(await existsExact(opts.profilePath, path))) {
        throw new Error(`Cannot read ${path} from local profile repo (${abs}): ${NOT_FOUND}`)
      }
      try {
        return await readFile(abs)
      } catch (e) {
        const why = (e as NodeJS.ErrnoException).code === 'ENOENT' ? 'file not found' : String(e)
        throw new Error(`Cannot read ${path} from local profile repo (${abs}): ${why}`)
      }
    }
  }
  const fetchImpl = opts.fetchImpl ?? fetch
  const base = githubRawBase(opts.ref)
  return async (path) => {
    const url = base + encodeURI(path)
    let res: Response
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    } catch (e) {
      throw new Error(`Cannot fetch ${path} from GitHub (${url}): ${(e as Error).message}`)
    }
    if (!res.ok) throw new Error(`GitHub raw returned HTTP ${res.status} for ${path} (${url})`)
    return Buffer.from(await res.arrayBuffer())
  }
}

/** Fails naming the path unless a `web/public/` asset exists where the site will serve it from. */
function publicChecker(opts: SyncOptions): (path: string) => Promise<void> {
  return async (path) => {
    const [where, root, rel] =
      opts.source === 'local'
        ? ['local profile repo', opts.profilePath, path]
        : ["website's public folder", join(opts.outDir, 'public'), path.slice(SITE_PUBLIC_PREFIX.length)]
    if (!(await existsExact(root, rel))) {
      throw new Error(`Cannot find ${path} in the ${where} (${join(root, rel)}): ${NOT_FOUND}`)
    }
  }
}

async function writeStaged(root: string, rel: string, data: Buffer): Promise<void> {
  const dest = join(root, rel)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, data)
}

/**
 * Moves each staged dir into place (atomic per dir; renames are retried while Windows reports the folder busy). On
 * failure everything already swapped is moved back. If a folder is still locked after the retries (typically a
 * running `next dev` holding public/content), the live dirs are updated file by file instead, with a warning.
 */
async function swapIn(stage: string, outDir: string, hooks: FsHooks = {}): Promise<void> {
  const move = (from: string, to: string) => renameWithRetry(from, to, hooks)
  const undo: (() => Promise<void>)[] = []
  try {
    for (const [i, t] of TARGETS.entries()) {
      const live = join(outDir, t.live)
      const old = join(stage, `old-${i}`)
      await mkdir(dirname(live), { recursive: true })
      if (existsSync(live)) {
        await move(live, old)
        undo.push(() => move(old, live))
      }
      await move(join(stage, t.staged), live)
      undo.push(() => move(live, join(stage, t.staged)))
    }
  } catch (e) {
    for (const step of undo.reverse()) await step().catch(() => {})
    if (!isLockedError(e)) throw new Error(`Cannot replace synced content in ${outDir}: ${(e as Error).message}`)
    await updateLiveInPlace(stage, outDir, e as Error)
  }
}

async function updateLiveInPlace(stage: string, outDir: string, cause: Error): Promise<void> {
  const leftovers: string[] = []
  try {
    for (const t of TARGETS) {
      const left = await updateInPlace(join(stage, t.staged), join(outDir, t.live))
      leftovers.push(...left.map((f) => join(t.live, f)))
    }
  } catch (e) {
    throw new Error(
      `Cannot replace synced content in ${outDir}: ${cause.message}; updating it in place also failed: ${(e as Error).message}` +
        ' (stop the dev server, e.g. with clean_restart.ps1, and sync again)',
    )
  }
  const yellow = (m: string) => `\x1b[33m${m}\x1b[0m`
  console.warn(
    yellow(
      `Warning: could not swap the synced folders in ${outDir} (${cause.message}); updated them in place instead. ` +
        'Is a dev server running? It may serve a mix of old and new files until it reloads.' +
        (leftovers.length > 0 ? ` Could not delete: ${leftovers.join(', ')}` : ''),
    ),
  )
}

export type SyncResult = {
  files: string[]
  certificates: number[]
  /** `vi`: a READMEVN.md was synced too. */
  projectReadmes: { slug: string; images: number; vi: boolean }[]
}

export async function syncContent(opts: SyncOptions): Promise<SyncResult> {
  const read = reader(opts)
  const readmes = Object.values(README_FILES)
  const texts = await Promise.all(readmes.map(read))

  const assets = new Set<string>()
  readmes.forEach((file, i) => {
    for (const a of referencedAssets(texts[i].toString('utf8'), file)) assets.add(safeRelPath(a, file))
  })
  const inPublic = [...assets].filter((a) => a.startsWith(SITE_PUBLIC_PREFIX))
  const assetList = [...assets].filter((a) => !a.startsWith(SITE_PUBLIC_PREFIX))
  await Promise.all(inPublic.map(publicChecker(opts)))
  const assetData = await Promise.all(assetList.map(read))
  const repoData = await Promise.all(SYNCED_REPO_FILES.map(([from]) => read(from)))
  const enReadme = README_FILES.en
  const certificates = await fetchCertificates(
    texts[readmes.indexOf(enReadme)].toString('utf8'),
    enReadme,
    opts.fetchImpl ?? fetch,
  )
  const certNumbers = certificates.map((c) => c.no).sort((a, b) => a - b)
  const projectReadmes = await fetchProjectReadmes(
    texts[readmes.indexOf(enReadme)].toString('utf8'),
    enReadme,
    opts.fetchImpl ?? fetch,
    opts.warn,
  )

  await mkdir(opts.outDir, { recursive: true })
  await withSyncLock(opts.outDir, () => stageAndSwap(opts, { readmes, texts, assetList, assetData, repoData, certificates, certNumbers, projectReadmes }), {
    timeoutMs: opts.lockTimeoutMs,
  })
  return {
    files: [...readmes, ...assetList, ...SYNCED_REPO_FILES.map(([from]) => from)],
    certificates: certNumbers,
    projectReadmes: projectReadmes.map((p) => ({ slug: p.slug, images: p.images.length, vi: p.markdownVi !== undefined })),
  }
}

type Staged = {
  readmes: string[]
  texts: Buffer[]
  assetList: string[]
  assetData: Buffer[]
  repoData: Buffer[]
  certificates: { no: number; data: Buffer }[]
  certNumbers: number[]
  projectReadmes: ProjectReadme[]
}

/** Writes everything into a fresh staging dir and swaps it in (run under the sync lock). */
async function stageAndSwap(opts: SyncOptions, d: Staged): Promise<void> {
  const { readmes, texts, assetList, assetData, repoData, certificates, certNumbers, projectReadmes } = d
  const stage = await mkdtemp(join(opts.outDir, '.sync-staging-'))
  try {
    for (const t of TARGETS) await mkdir(join(stage, t.staged), { recursive: true })
    await Promise.all(readmes.map((f, i) => writeStaged(join(stage, 'content'), f, texts[i])))
    await Promise.all(assetList.map((a, i) => writeStaged(join(stage, 'public-content'), a, assetData[i])))
    await Promise.all(SYNCED_REPO_FILES.map(([, to], i) => writeStaged(join(stage, 'content'), to, repoData[i])))
    await Promise.all(certificates.map((c) => writeStaged(join(stage, 'public-content'), certificatePdfPath(c.no), c.data)))
    await writeStaged(join(stage, 'content'), CERTIFICATES_MANIFEST, Buffer.from(`${JSON.stringify(certNumbers)}\n`))
    await stageProjectReadmes(stage, projectReadmes)
    await swapIn(stage, opts.outDir, opts.fsHooks)
  } finally {
    // Content is already swapped in by now; on Windows the cleanup can hit EBUSY/EPERM (antivirus, indexer).
    // That must not fail the sync, so retry a few times and then only warn.
    try {
      await (opts.rmImpl ?? rm)(stage, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    } catch (e) {
      console.warn(`Warning: could not remove staging folder ${stage}: ${(e as Error).message}`)
    }
  }
}

/**
 * Each project README -> `content/project-readmes/<slug>.md` (and its READMEVN.md -> `<slug>.vi.md`), their shared
 * images under `public/content/`, and the manifest.
 */
async function stageProjectReadmes(stage: string, projects: ProjectReadme[]): Promise<void> {
  const manifest: ProjectReadmeManifest = {}
  for (const p of projects) {
    manifest[p.slug] = {
      repoUrl: p.repoUrl,
      images: p.images.map((i) => i.path),
      ...(p.markdownVi && { vi: true }),
      ...(p.files.length > 0 && { files: p.files.map((f) => f.path) }),
    }
    await writeStaged(join(stage, 'content', PROJECT_READMES_DIR), readmeFileName(p.slug, 'en'), p.markdown)
    if (p.markdownVi) await writeStaged(join(stage, 'content', PROJECT_READMES_DIR), readmeFileName(p.slug, 'vi'), p.markdownVi)
    const imageRoot = join(stage, 'public-content', PROJECT_READMES_DIR, p.slug)
    await Promise.all(p.images.map((i) => writeStaged(imageRoot, i.path, i.data)))
    // Linked text files (analytics projects) are read by the server, so they live under content/, not public/.
    await Promise.all(p.files.map((f) => writeStaged(join(stage, 'content', PROJECT_READMES_DIR, p.slug), f.path, f.data)))
  }
  await writeStaged(join(stage, 'content'), PROJECT_READMES_MANIFEST, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`))
}

async function main(): Promise<void> {
  const source = (process.env.CONTENT_SOURCE ?? 'github').trim() || 'github'
  if (source !== 'local' && source !== 'github') {
    throw new Error(`CONTENT_SOURCE must be "local" or "github", got "${source}"`)
  }
  const profilePath = process.env.PROFILE_REPO_PATH?.trim() || DEFAULT_PROFILE_REPO_PATH
  const ref = process.env.CONTENT_REF?.trim() || DEFAULT_CONTENT_REF
  const { files, certificates, projectReadmes } = await syncContent({ source, profilePath, ref, outDir: process.cwd() })
  const images = projectReadmes.reduce((n, p) => n + p.images, 0)
  console.log(
    `Synced ${files.length} files from ${source === 'github' ? `github @ ${ref}` : source}` +
      `, ${certificates.length} certificate PDFs (№ ${certificates.join(', ')})` +
      ` and ${projectReadmes.length} project READMEs (${projectReadmes.filter((p) => p.vi).length} also in Vietnamese)` +
      ` with ${images} images`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(`sync-content failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
}
