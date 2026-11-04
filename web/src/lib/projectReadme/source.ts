/**
 * Where a project's own README lives, derived from the project's `repoUrl` (the profile README's `####`
 * heading link), and how repo-relative paths inside that README resolve. Pure (no imports), so the content sync
 * (downloads) and the project page (render) agree on every URL.
 *
 *   https://github.com/<owner>/<repo>                         -> <repo> @ main, README.md
 *   https://github.com/<owner>/<repo>/tree/<ref>/<folder...>  -> <repo> @ <ref>, <folder...>/README.md
 */

export type ReadmeSource = {
  owner: string
  repo: string
  ref: string
  /** The README's folder inside the repo, decoded, `/`-separated; `''` for the repo root. */
  dir: string
  /** The README's path inside the repo (`dir/README.md`). */
  path: string
}

const DEFAULT_REF = 'main'
const NAME = /^[A-Za-z0-9._-]+$/
const GITHUB_REPO_URL = /^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+?)(?:\.git)?(?:\/tree\/([^/?#]+)((?:\/[^?#]*)?))?\/?(?:[?#].*)?$/

/** The README location for a GitHub repo or repo-folder URL; throws naming the URL if it is neither. */
export function readmeSource(repoUrl: string): ReadmeSource {
  const m = GITHUB_REPO_URL.exec(repoUrl.trim())
  if (!m || !NAME.test(m[1]) || !NAME.test(m[2]) || (m[3] !== undefined && !NAME.test(m[3]))) {
    throw new Error(`not a GitHub repo or repo-folder URL: ${repoUrl}`)
  }
  let folder = ''
  if (m[4]) {
    const resolved = resolveRepoPath('', m[4].replace(/^\/+|\/+$/g, ''))
    if (resolved === undefined) throw new Error(`bad folder in GitHub URL: ${repoUrl}`)
    folder = resolved
  }
  const ref = m[3] ?? DEFAULT_REF
  return { owner: m[1], repo: m[2], ref, dir: folder, path: folder ? `${folder}/README.md` : 'README.md' }
}

/** `http:`, `mailto:`, `data:`... or protocol-relative `//host`; `#anchors` point into the page. */
const NOT_RELATIVE = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i
/** Characters no served file name may hold (Windows-invalid, controls, backslash). */
const BAD_CHARS = /[<>:"|?*\\\u0000-\u001f]/

export function isRepoRelative(url: string): boolean {
  const u = url.trim()
  return u !== '' && !NOT_RELATIVE.test(u)
}

/**
 * The repo path (decoded, normalised, no leading `/`) a README-relative URL points to: relative to the README's
 * folder, or to the repo root when it starts with `/` (as on GitHub). Query and fragment are dropped.
 * Undefined when the path escapes the repo (`..` past the root), is malformed (bad `%` escape) or holds characters a
 * file name cannot.
 */
export function resolveRepoPath(dir: string, url: string): string | undefined {
  const bare = url.trim().replace(/[?#].*$/, '')
  if (bare === '') return undefined
  let decoded: string
  try {
    decoded = decodeURIComponent(bare)
  } catch {
    return undefined
  }
  if (BAD_CHARS.test(decoded)) return undefined
  const parts = decoded.startsWith('/') ? [] : dir.split('/').filter(Boolean)
  for (const seg of decoded.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (parts.length === 0) return undefined
      parts.pop()
    } else parts.push(seg)
  }
  return parts.length > 0 ? parts.join('/') : undefined
}

/** Each segment URI-encoded, so spaces, `#`, `?`, `%` and `&` in names are safe in a URL path. */
export const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** GitHub page of a file in the repo (where repo-relative README links point to). */
export const blobUrl = (s: ReadmeSource, path: string) =>
  `https://github.com/${s.owner}/${s.repo}/blob/${s.ref}/${encodePath(path)}`

/** Download sources of a file in the repo: GitHub raw first, then the jsDelivr CDN. */
export function rawSources(s: ReadmeSource, path: string): { label: string; url: string }[] {
  return [
    { label: 'GitHub raw', url: `https://raw.githubusercontent.com/${s.owner}/${s.repo}/${s.ref}/${encodePath(path)}` },
    { label: 'jsDelivr', url: `https://cdn.jsdelivr.net/gh/${s.owner}/${s.repo}@${s.ref}/${encodePath(path)}` },
  ]
}

/** Synced README text: `content/<PROJECT_READMES_DIR>/<slug>.md`; images: `public/content/<dir>/<slug>/<repo path>`. */
export const PROJECT_READMES_DIR = 'project-readmes'
/** `content/project-readmes.json`: `{ [slug]: { repoUrl, images: [repo paths downloaded] } }`. */
export const PROJECT_READMES_MANIFEST = 'project-readmes.json'

/**
 * `vi`: the repo also has a Vietnamese `READMEVN.md` next to the README (synced as `<slug>.vi.md`); it uses the same
 * images, so `images` covers both.
 */
export type ProjectReadmeEntry = { repoUrl: string; images: string[]; vi?: boolean }
export type ProjectReadmeManifest = Record<string, ProjectReadmeEntry>

/** Where a downloaded README image is served from. */
export const readmeImageUrl = (slug: string, path: string) => `/content/${PROJECT_READMES_DIR}/${slug}/${encodePath(path)}`

/** The Vietnamese README the sync also fetches: `READMEVN.md` in the README's folder (optional). */
export const readmeViPath = (s: ReadmeSource) => (s.dir ? `${s.dir}/READMEVN.md` : 'READMEVN.md')

/** Synced README file name under `content/<PROJECT_READMES_DIR>/`: `<slug>.md` (English) or `<slug>.vi.md`. */
export const readmeFileName = (slug: string, lang: 'en' | 'vi') => (lang === 'vi' ? `${slug}.vi.md` : `${slug}.md`)
