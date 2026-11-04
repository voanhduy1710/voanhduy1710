/**
 * Full READMEs of every project (My works and BI) for the content sync. Each project's README location comes from its
 * `repoUrl` (the profile README's `####` heading link; see src/lib/projectReadme/source.ts), so there is no list to
 * keep in step. Same in local and github content modes (those repos are never local).
 *
 *   - README: raw.githubusercontent.com, then the jsDelivr CDN; if neither serves it the sync fails naming both.
 *   - READMEVN.md (the Vietnamese README in the same folder, for /vi): same sources, optional. Missing (404 on both)
 *     is fine and silent; any other failure warns. Either way /vi then shows the English README.
 *   - Repo-relative images either README shows (deduped, downloaded once and shared by both) (markdown `![]()`, `<img src>`): downloaded from the same sources. One that cannot
 *     be fetched, escapes the repo, is not a raster image, or would take the project past its image budget is skipped
 *     with a warning (the page drops it): it belongs to another repo and must not break this site's build.
 *   - PNG/JPEG images are converted to WebP (max 1600 px wide, quality 82) with sharp and saved as `<path>.webp`; GIFs
 *     (animation) and already-WebP/AVIF files are kept. If sharp fails on a file the original bytes are kept with a
 *     warning (the build never fails for this). The image budget counts the converted size.
 *   - shields.io badges and other absolute images are never downloaded: the page renders badges as native chips and
 *     other images as links (no third-party image request at runtime).
 */
import { findSection } from '../src/lib/content/markers'
import { parseProjects } from '../src/lib/content/parse/projects'
import { relativeImagePaths } from '../src/lib/projectReadme/render'
import { rawSources, readmeSource, readmeViPath, type ReadmeSource } from '../src/lib/projectReadme/source'
import { attempt, firstWorking } from './sync-certificates'

const HEADERS = { 'User-Agent': 'voanhduy1710-portfolio-sync' }
/** Images served from the site's own origin: raster only (an SVG opened directly could run script). */
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)$/i
/** Max bytes of README images per project; images past it are skipped with a warning. */
export const IMAGE_BUDGET = 5 * 1024 * 1024

/** Raster formats re-encoded as WebP. GIF is kept (animation); WebP/AVIF are already compact. */
const CONVERT_EXT = /\.(png|jpe?g)$/i

export type ImageConverter = (data: Buffer) => Promise<Buffer>

/** Default converter: sharp, longest side capped at 1600 px wide (never enlarged), WebP quality 82. */
export const convertWithSharp: ImageConverter = async (data) => {
  const { default: sharp } = await import('sharp')
  return sharp(data).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
}

export type ProjectReadme = {
  slug: string
  repoUrl: string
  markdown: Buffer
  /** The repo's READMEVN.md next to the README, if it has one. */
  markdownVi?: Buffer
  /** Downloaded images, keyed by the path they are served under (a converted `x.png` is `x.png.webp`). */
  images: { path: string; data: Buffer }[]
}

/** A README text (`path` in the repo): GitHub raw, then jsDelivr; an empty body counts as a failed source. */
async function downloadReadme(fetchImpl: typeof fetch, slug: string, src: ReadmeSource, path = src.path): Promise<Buffer> {
  const read = async (r: Response) => {
    const data = Buffer.from(await r.arrayBuffer())
    if (data.length === 0) throw new Error('the README is empty')
    return data
  }
  const what = `the README of project ${slug} (${src.owner}/${src.repo} @ ${src.ref}: ${path})`
  return firstWorking(fetchImpl, what, rawSources(src, path).map((s) => ({ ...s, headers: HEADERS, read })))
}

/** READMEVN.md, or undefined: silently when every source answers 404 (no translation), with a warning otherwise. */
async function downloadReadmeVi(
  fetchImpl: typeof fetch,
  slug: string,
  src: ReadmeSource,
  warn: (message: string) => void,
): Promise<Buffer | undefined> {
  const path = readmeViPath(src)
  try {
    return await downloadReadme(fetchImpl, slug, src, path)
  } catch (e) {
    const message = (e as Error).message
    // firstWorking names one failure per source: all of them a 404 means the repo simply has no translation.
    const allMissing = (message.match(/ returned HTTP 404 \(/g) ?? []).length === rawSources(src, path).length
    if (!allMissing) warn(`Warning: project ${slug}: no Vietnamese README, /vi shows the English one: ${message}`)
    return undefined
  }
}

/** One image's bytes from the first source that serves it, or the failed attempts. */
async function downloadImage(fetchImpl: typeof fetch, src: ReadmeSource, path: string): Promise<Buffer | string> {
  const failures: string[] = []
  for (const s of rawSources(src, path)) {
    const res = await attempt(fetchImpl, s.url, HEADERS)
    if (typeof res === 'string') {
      failures.push(`${s.label} ${res}`)
      continue
    }
    let data: Buffer
    try {
      data = Buffer.from(await res.arrayBuffer())
    } catch (e) {
      // e.g. the request timed out while the body was still arriving: try the next source.
      failures.push(`${s.label} body failed: ${(e as Error).message}`)
      continue
    }
    if (data.length > 0) return data
    failures.push(`${s.label} empty body`)
  }
  return failures.join(', ')
}

async function fetchOne(
  fetchImpl: typeof fetch,
  project: { slug: string; repoUrl: string },
  warn: (message: string) => void,
  convert: ImageConverter,
): Promise<ProjectReadme> {
  let src: ReadmeSource
  try {
    src = readmeSource(project.repoUrl)
  } catch (e) {
    throw new Error(`project ${project.slug}: ${(e as Error).message}`)
  }
  const [markdown, markdownVi] = await Promise.all([
    downloadReadme(fetchImpl, project.slug, src),
    downloadReadmeVi(fetchImpl, project.slug, src, warn),
  ])
  // Images of both READMEs (normally the same ones), each path once: downloaded once, served to both languages.
  const lists = [markdown, ...(markdownVi ? [markdownVi] : [])].map((m) => relativeImagePaths(m.toString('utf8'), src))
  const paths = [...new Set(lists.flatMap((l) => l.paths))]
  const rejected = [...new Set(lists.flatMap((l) => l.rejected))]
  const skip = (what: string, why: string) => warn(`Warning: project ${project.slug}: skipped README image ${what}: ${why}`)
  for (const r of rejected) skip(r, 'the path is outside the repo or not a valid file name')

  const wanted = paths.filter((p) => IMAGE_EXT.test(p))
  for (const p of paths) if (!IMAGE_EXT.test(p)) skip(p, 'not a PNG/JPEG/GIF/WebP/AVIF image')
  const fetched = await Promise.all(wanted.map((p) => downloadImage(fetchImpl, src, p)))
  const prepared = await Promise.all(
    wanted.map(async (path, i): Promise<{ path: string; data: Buffer } | string> => {
      const data = fetched[i]
      if (typeof data === 'string') return data
      if (!CONVERT_EXT.test(path)) return { path, data }
      try {
        const webp = await convert(data)
        // Keep the original if re-encoding did not shrink it (or produced nothing).
        if (webp.length > 0 && webp.length < data.length) return { path: `${path}.webp`, data: webp }
      } catch (e) {
        warn(`Warning: project ${project.slug}: could not convert README image ${path} to WebP, keeping the original: ${(e as Error).message}`)
      }
      return { path, data }
    }),
  )
  const images: ProjectReadme['images'] = []
  const budget = IMAGE_BUDGET
  let used = 0
  wanted.forEach((path, i) => {
    const img = prepared[i]
    if (typeof img === 'string') return skip(path, `cannot fetch it (${img})`)
    if (used + img.data.length > budget) {
      return skip(path, `the project's README images would exceed ${budget / 1024 / 1024} MB`)
    }
    used += img.data.length
    images.push(img)
  })
  return { slug: project.slug, repoUrl: project.repoUrl, markdown, ...(markdownVi && { markdownVi }), images }
}

/**
 * The READMEs (and their images) of all projects in `readme` (the EN profile README's text). A README
 * without a Projects section needs none (the full parse at build time reports the missing section).
 */
export async function fetchProjectReadmes(
  readme: string,
  readmeFile: string,
  fetchImpl: typeof fetch,
  warn: (message: string) => void = (m) => console.warn(`\x1b[33m${m}\x1b[0m`),
  convert: ImageConverter = convertWithSharp,
): Promise<ProjectReadme[]> {
  const section = findSection(readme, 'projects')
  if (section === undefined) return []
  return Promise.all(parseProjects(section, readmeFile).map((p) => fetchOne(fetchImpl, p, warn, convert)))
}
