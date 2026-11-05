/**
 * Smoke test of the production build: every `href` / `src` in the prerendered pages (`.next/server/app/**\/*.html`)
 * must be one of
 *   - absolute `http(s):`, `mailto:` or `tel:`, or an in-page `#anchor`;
 *   - a `/_next/...` build asset, or a `/api/...` route handler (dynamic, never prerendered);
 *   - a `/` path that is a prerendered route (or a fixed redirect source such as `/`);
 *   - a `/` path naming a file under `public/` with exactly that spelling (this includes the synced `/content/...`).
 * Anything else (e.g. a README-relative `CV_...pdf` that the browser would resolve to `/en/CV_...pdf`) is listed and
 * the command exits non-zero. It also fails if a required route (each language x each config-file view, and each
 * language x each certificate the content sync downloaded a PDF for, and each language x each analysis page of the
 * analytics project's synced README) was not prerendered. The certificate pages'
 * `/content/certificates/<no>.pdf` links are ordinary public files.
 *
 * CLI: `npm run check:links` after `npm run build`, from `web/`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeEntities } from '../src/lib/content/mdast'
import { parseCertificateManifest } from '../src/lib/certificateManifest'
import { certificateHref, CERTIFICATES_MANIFEST } from '../src/lib/certificates'
import { LANGS } from '../src/lib/content/types'
import { README_FILES } from '../src/lib/content/index'
import { findSection } from '../src/lib/content/markers'
import { parseProjects } from '../src/lib/content/parse/projects'
import { splitGroups } from '../src/lib/projectGroups'
import { analysisSlugs, splitAnalyses } from '../src/lib/projectReadme/analyses'
import { PROJECT_READMES_DIR, PROJECT_READMES_MANIFEST, readmeFileName } from '../src/lib/projectReadme/source'
import { parseProjectReadmeManifest } from '../src/lib/projectReadmeManifest'
import { REPO_FILES, repoFileHref } from '../src/lib/repoFiles'
import { existsExact } from './sync-content'

export type BrokenLink = { page: string; attr: string; url: string }

const ATTR_URL = /\s(href|src)\s*=\s*"([^"]*)"/gi
const ABSOLUTE_OK = /^(https?:|mailto:|tel:|#)/i

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return htmlFiles(p)
    return e.isFile() && e.name.endsWith('.html') ? [p] : []
  })
}

/**
 * Path part of a site-root URL, each segment URI-decoded (`/logos/Google%20Cloud%20Run.png?x` ->
 * `/logos/Google Cloud Run.png`; also `%23`, `%26`... as the project-README image URLs encode them).
 */
function pathOf(url: string): string | undefined {
  try {
    return url
      .replace(/[?#].*$/, '')
      .split('/')
      .map(decodeURIComponent)
      .join('/')
  } catch {
    return undefined
  }
}

/** Every href/src in the built pages under `appDir` that does not resolve to a route, a public file or a build asset. */
export async function findBrokenLinks(opts: { appDir: string; publicDir: string; routes: Iterable<string> }): Promise<BrokenLink[]> {
  const routes = new Set([...opts.routes].map((r) => (r.length > 1 ? r.replace(/\/$/, '') : r)))
  const known = new Map<string, boolean>()
  const broken: BrokenLink[] = []

  for (const file of htmlFiles(opts.appDir)) {
    const html = readFileSync(file, 'utf8')
    for (const [, attr, raw] of html.matchAll(ATTR_URL)) {
      const url = decodeEntities(raw).trim()
      if (ABSOLUTE_OK.test(url) || url.startsWith('/_next/') || url.startsWith('/api/')) continue
      let ok = false
      if (url.startsWith('/') && !url.startsWith('//')) {
        const path = pathOf(url)
        if (path !== undefined) {
          const route = path.length > 1 ? path.replace(/\/$/, '') : path
          if (routes.has(route)) ok = true
          else {
            if (!known.has(path)) known.set(path, await existsExact(opts.publicDir, path.slice(1)))
            ok = known.get(path) === true
          }
        }
      }
      if (!ok) broken.push({ page: relative(opts.appDir, file).replace(/\\/g, '/'), attr: attr.toLowerCase(), url })
    }
  }
  return broken
}

/** Prerendered routes plus parameter-free redirect sources (`/` -> `/en`) of a `.next` build dir. */
export function buildRoutes(nextDir: string): string[] {
  const prerender = JSON.parse(readFileSync(join(nextDir, 'prerender-manifest.json'), 'utf8')) as { routes: Record<string, unknown> }
  const manifest = JSON.parse(readFileSync(join(nextDir, 'routes-manifest.json'), 'utf8')) as { redirects?: { source: string }[] }
  const redirects = (manifest.redirects ?? []).map((r) => r.source).filter((s) => !s.includes(':'))
  return [...Object.keys(prerender.routes), ...redirects]
}

/** Routes the build must prerender: the read-only view of every allow-listed config file, in every language. */
export const REQUIRED_ROUTES = LANGS.flatMap((lang) => REPO_FILES.map((f) => repoFileHref(lang, f)))

/** The certificate pages the build must prerender: each language x each synced certificate PDF. */
export function certificateRoutes(numbers: Iterable<number>): string[] {
  const nos = [...numbers]
  return LANGS.flatMap((lang) => nos.map((no) => certificateHref(lang, no)))
}

/**
 * The analysis pages the build must prerender: each language x each numbered analysis of every analytics project's
 * synced README (`/{lang}/projects/<slug>/<analysis>`). `readmeEn`: the profile README (which projects are analytics);
 * `projectReadme(slug)`: that project's synced English README, if any.
 */
export function analysisRoutes(readmeEn: string, readmeFile: string, projectReadme: (slug: string) => string | undefined): string[] {
  const section = findSection(readmeEn, 'projects')
  if (section === undefined) return []
  const analytics = splitGroups(parseProjects(section, readmeFile)).analytics
  return analytics.flatMap((p) => {
    const md = projectReadme(p.slug)
    const sections = md === undefined ? [] : (splitAnalyses(md)?.sections ?? [])
    const slugs = [...analysisSlugs(sections).values()]
    return LANGS.flatMap((lang) => slugs.map((a) => `/${lang}/projects/${p.slug}/${a}`))
  })
}

/** The required routes that are not among the build's routes. */
export function missingRoutes(routes: Iterable<string>, required: readonly string[] = REQUIRED_ROUTES): string[] {
  const have = new Set(routes)
  return required.filter((r) => !have.has(r))
}

async function main(): Promise<void> {
  const root = process.cwd()
  const nextDir = join(root, '.next')
  const appDir = join(nextDir, 'server', 'app')
  if (!existsSync(appDir)) throw new Error(`no build output at ${appDir}: run "npm run build" first`)
  const pages = htmlFiles(appDir).length
  const routes = buildRoutes(nextDir)
  const certs = certificateRoutes(parseCertificateManifest(readFileSync(join(root, 'content', CERTIFICATES_MANIFEST), 'utf8')))
  const manifest = parseProjectReadmeManifest(readFileSync(join(root, 'content', PROJECT_READMES_MANIFEST), 'utf8'))
  const analyses = analysisRoutes(readFileSync(join(root, 'content', README_FILES.en), 'utf8'), README_FILES.en, (slug) =>
    Object.hasOwn(manifest, slug) ? readFileSync(join(root, 'content', PROJECT_READMES_DIR, readmeFileName(slug, 'en')), 'utf8') : undefined,
  )
  const missing = missingRoutes(routes, [...REQUIRED_ROUTES, ...certs, ...analyses])
  if (missing.length > 0) {
    console.error(`check-links: ${missing.length} required route(s) not prerendered:`)
    for (const r of missing) console.error(`  ${r}`)
    process.exit(1)
  }
  const broken = await findBrokenLinks({ appDir, publicDir: join(root, 'public'), routes })
  if (broken.length > 0) {
    console.error(`check-links: ${broken.length} broken link(s) in ${pages} pages:`)
    for (const b of broken) console.error(`  ${b.page}: ${b.attr}="${b.url}"`)
    process.exit(1)
  }
  console.log(
    `check-links: all links in ${pages} pages resolve; all ${REQUIRED_ROUTES.length} config-file routes and ` +
      `${certs.length} certificate routes and ${analyses.length} analysis routes prerendered`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(`check-links failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
}
