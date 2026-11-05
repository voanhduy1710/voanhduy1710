import { readFileSync } from 'node:fs'
import { contentPath } from './contentDir'
import { cachedBySyncedFiles } from './syncedCache'
import {
  PROJECT_READMES_DIR,
  PROJECT_READMES_MANIFEST,
  readmeFileName,
  readmeImageUrl,
  type ProjectReadmeEntry,
  type ProjectReadmeManifest,
} from './projectReadme/source'

/** Parses `content/project-readmes.json`; throws naming the file if it is not `{ slug: { repoUrl, images[] } }`. */
export function parseProjectReadmeManifest(text: string): ProjectReadmeManifest {
  const value: unknown = JSON.parse(text)
  const ok =
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (e: unknown) =>
        typeof (e as ProjectReadmeEntry)?.repoUrl === 'string' &&
        Array.isArray((e as ProjectReadmeEntry).images) &&
        (e as ProjectReadmeEntry).images.every((i) => typeof i === 'string') &&
        ['undefined', 'boolean'].includes(typeof (e as ProjectReadmeEntry).vi) &&
        ((e as ProjectReadmeEntry).files === undefined ||
          (Array.isArray((e as ProjectReadmeEntry).files) && (e as ProjectReadmeEntry).files!.every((f) => typeof f === 'string'))),
    )
  if (!ok) throw new Error(`content/${PROJECT_READMES_MANIFEST} must map project slugs to { repoUrl, images, vi?, files? }`)
  return value as ProjectReadmeManifest
}

function readSynced(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch (e) {
    throw new Error(`Cannot read ${path} (written by the content sync: run "npm run sync"): ${(e as Error).message}`)
  }
}

/**
 * The synced project-README manifest; missing = the sync has not run (fails with a hint). Re-read when the sync
 * rewrites it, so a running `next dev` picks up a re-sync (new projects, `.png.webp` image names).
 */
export const loadProjectReadmeManifest: () => ProjectReadmeManifest = cachedBySyncedFiles(
  () => [contentPath(PROJECT_READMES_MANIFEST)],
  () => parseProjectReadmeManifest(readSynced(contentPath(PROJECT_READMES_MANIFEST))),
)

export type LoadedProjectReadme = ProjectReadmeEntry & {
  markdown: string
  /** Language of `markdown`: `vi` only when asked for and the repo has a READMEVN.md, else `en`. */
  lang: 'en' | 'vi'
}

/**
 * A project's own README as synced (text, repo URL, downloaded images), or undefined if none was synced. With
 * `lang` `vi`: the repo's READMEVN.md when it has one, else the English README (`lang` says which).
 */
export function loadProjectReadme(slug: string, lang: 'en' | 'vi' = 'en'): LoadedProjectReadme | undefined {
  const manifest = loadProjectReadmeManifest()
  const entry = Object.hasOwn(manifest, slug) ? manifest[slug] : undefined
  if (!entry) return undefined
  const served = lang === 'vi' && entry.vi === true ? 'vi' : 'en'
  return { ...entry, lang: served, markdown: readSynced(contentPath(PROJECT_READMES_DIR, readmeFileName(slug, served))) }
}

/**
 * Served URL of the first image the project's synced README shows (the sync lists them in README order, under their
 * served names such as `<path>.png.webp`), or undefined if it shows none. The home card uses it as its thumbnail when
 * the profile README has no preview for the project (e.g. the BI dashboards).
 */
export function readmeCoverUrl(slug: string): string | undefined {
  const manifest = loadProjectReadmeManifest()
  const first = Object.hasOwn(manifest, slug) ? manifest[slug].images[0] : undefined
  return first === undefined ? undefined : readmeImageUrl(slug, first)
}

/**
 * Text of a repo file the sync saved for a project (one of its manifest `files`), or undefined if it was not synced.
 * Only listed paths are read, so a README link can never make the site read another file.
 */
export function loadProjectReadmeFile(slug: string, path: string): string | undefined {
  const manifest = loadProjectReadmeManifest()
  const entry = Object.hasOwn(manifest, slug) ? manifest[slug] : undefined
  if (!entry?.files?.includes(path)) return undefined
  return readSynced(contentPath(PROJECT_READMES_DIR, slug, ...path.split('/')))
}
