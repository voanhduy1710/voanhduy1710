/**
 * A project's own README (GitHub-flavoured markdown with raw HTML) -> a sanitised HTML tree for the project page.
 * Pure: no file or network access. Used at build time by the content sync (which images to download) and by the
 * project page (render).
 *
 * Pipeline: remark-parse + remark-gfm -> remark-rehype (raw HTML kept) -> rehype-raw -> rehype-sanitize (GitHub's
 * schema: no scripts, styles, iframes, event handlers, `javascript:` URLs) -> rewrite (below) -> rehype-slug.
 *
 * Rewrite, so the page makes no third-party image request:
 *   - repo-relative images -> the synced copy (`/content/project-readmes/<slug>/<path>`), dropped if not synced;
 *   - shields.io badges -> `<badge-chip>` elements (rendered as native BadgeChips);
 *   - other absolute images -> a link to the image, labelled with its alt text (plain text inside a link);
 *   - `<picture><source>` variants -> dropped (the fallback `<img>` stays);
 *   - repo-relative links -> the file on GitHub (`/blob/<ref>/<path>`), or where `linkTarget` says (an in-page
 *     anchor, or no link); absolute links open in a new tab;
 *     in-page `#anchors` stay (headings get GitHub-style ids, via github-slugger: `#3-cấu-hình-biến-môi-trường`);
 *   - with `dropLanguageLink` (READMEVN.md on /vi): the `> 🇬🇧 English version: [README.md](README.md)` blockquote
 *     is dropped, as the site has its own EN/VI switch.
 */
import type { Element, ElementContent, Root, RootContent } from 'hast'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { parseShieldsBadge } from '../content/parse/badges'
import type { Badge } from '../content/types'
import { blobUrl, isRepoRelative, readmeImageUrl, resolveRepoPath, type ReadmeSource } from './source'

/** GitHub's schema, plus `align` / `width` / `height` on images, paragraphs and cells, and `<style>` dropped whole. */
export const README_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  strip: [...(defaultSchema.strip ?? []), 'style'],
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img ?? []), 'align', 'width', 'height', 'alt'],
    p: [...(defaultSchema.attributes?.p ?? []), 'align'],
    td: [...(defaultSchema.attributes?.td ?? []), 'align', 'width', 'height'],
  },
}

const sanitizer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, README_SCHEMA)

const slugger = unified().use(rehypeSlug)

/** The README as a sanitised HTML tree (before any rewrite). */
export function sanitizedTree(markdown: string): Root {
  return sanitizer.runSync(sanitizer.parse(markdown)) as Root
}

const isElement = (n: RootContent | ElementContent): n is Element => n.type === 'element'

function walk(node: Root | Element, visit: (e: Element) => void): void {
  for (const child of node.children) {
    if (!isElement(child)) continue
    visit(child)
    walk(child, visit)
  }
}

/** The `src` of every image in a sanitised tree, in document order (as written: not decoded or resolved). */
export function imageSources(tree: Root): string[] {
  const out: string[] = []
  walk(tree, (e) => {
    if (e.tagName === 'img' && typeof e.properties.src === 'string') out.push(e.properties.src)
  })
  return out
}

const SHIELDS = /^https?:\/\/img\.shields\.io\//i

/** Repo paths of the README images the sync should download (repo-relative only; escaping paths are skipped). */
export function relativeImagePaths(markdown: string, source: ReadmeSource): { paths: string[]; rejected: string[] } {
  const paths: string[] = []
  const rejected: string[] = []
  for (const src of imageSources(sanitizedTree(markdown))) {
    if (!isRepoRelative(src)) continue
    const path = resolveRepoPath(source.dir, src)
    if (path === undefined) rejected.push(src)
    else if (!paths.includes(path)) paths.push(path)
  }
  return { paths, rejected }
}

export type RewriteContext = {
  slug: string
  source: ReadmeSource
  /**
   * Paths of the images the sync saved; other repo-relative images are dropped. A PNG/JPEG converted at sync time is
   * listed as `<repo path>.webp` and is what the page serves.
   */
  images: ReadonlySet<string>
  /** Drop the README's language-switch blockquote (a one-line quote linking to the other README.md / READMEVN.md). */
  dropLanguageLink?: boolean
  /**
   * Where a repo-relative link goes (`path`: the repo path it resolves to): a URL on this site (e.g. `#file-...`, the
   * file shown in-page), `null` for no link at all (plain text), or `undefined` for the default (the file on GitHub).
   * The analytics project's pages pass it so no analysis sends visitors to GitHub.
   */
  linkTarget?: (path: string) => string | null | undefined
}

/** Tag of the placeholder element a shields.io badge becomes; the page renders it as a BadgeChip. */
export const BADGE_TAG = 'badge-chip'

export function badgeElement(b: Badge): Element {
  return { type: 'element', tagName: BADGE_TAG, properties: { dataLabel: b.label, dataMessage: b.message, dataColor: b.color }, children: [] }
}

/** Reads a badge placeholder's properties back (as hast properties or as the React props they become). */
export function badgeFromProps(p: Record<string, unknown>): Badge {
  const get = (k: string) => String(p[k] ?? p[`data-${k}`] ?? p[`data${k[0].toUpperCase()}${k.slice(1)}`] ?? '')
  return { label: get('label'), message: get('message'), color: get('color') }
}

const EXTERNAL = { target: '_blank', rel: ['noopener', 'noreferrer'] }

function externalImageLink(src: string, alt: string, insideLink: boolean): ElementContent[] {
  const file = src.replace(/[?#].*$/, '').split('/').pop() || src
  let label = alt
  if (!label) {
    try {
      label = decodeURIComponent(file)
    } catch {
      label = file
    }
  }
  const text: ElementContent = { type: 'text', value: label }
  if (insideLink) return [text]
  return [{ type: 'element', tagName: 'a', properties: { href: src, ...EXTERNAL }, children: [text] }]
}

function rewriteImage(img: Element, ctx: RewriteContext, insideLink: boolean): ElementContent[] {
  const src = typeof img.properties.src === 'string' ? img.properties.src.trim() : ''
  const alt = typeof img.properties.alt === 'string' ? img.properties.alt.trim() : ''
  if (src === '') return []
  if (SHIELDS.test(src)) {
    try {
      return [badgeElement(parseShieldsBadge(src, alt))]
    } catch {
      return externalImageLink(src, alt, insideLink)
    }
  }
  if (!isRepoRelative(src)) return externalImageLink(src, alt, insideLink)
  const path = resolveRepoPath(ctx.source.dir, src)
  if (path === undefined) return []
  const served = ctx.images.has(`${path}.webp`) ? `${path}.webp` : path
  if (!ctx.images.has(served)) return []
  img.properties.src = readmeImageUrl(ctx.slug, served)
  img.properties.loading = 'lazy'
  img.properties.decoding = 'async'
  if (img.properties.alt === undefined) img.properties.alt = ''
  return [img]
}

function rewriteLink(a: Element, ctx: RewriteContext): void {
  const href = typeof a.properties.href === 'string' ? a.properties.href.trim() : undefined
  if (href === undefined) return
  if (href.startsWith('#')) {
    // The markdown parser percent-encodes `#3-cấu-hình-...`; heading ids are the plain text (github-slugger).
    try {
      a.properties.href = decodeURIComponent(href)
    } catch {
      // keep a malformed escape as written
    }
    return
  }
  if (isRepoRelative(href)) {
    const path = resolveRepoPath(ctx.source.dir, href)
    if (path === undefined) {
      delete a.properties.href
      return
    }
    const local = ctx.linkTarget?.(path)
    if (local === null) {
      delete a.properties.href
      return
    }
    if (local !== undefined) {
      a.properties.href = local
      return
    }
    const hash = /#.*$/.exec(href)?.[0] ?? ''
    a.properties.href = blobUrl(ctx.source, path) + hash
  }
  Object.assign(a.properties, EXTERNAL)
}

const OTHER_README = /(^|\/)README(VN)?\.md$/i
const isBlank = (n: ElementContent) => n.type === 'text' && n.value.trim() === ''

/**
 * `> 🇬🇧 English version: [README.md](README.md)`: a blockquote holding a single paragraph that links to a
 * README.md / READMEVN.md in the repo (checked before links are rewritten).
 */
function isLanguageLink(e: Element, ctx: RewriteContext): boolean {
  if (e.tagName !== 'blockquote') return false
  const kids = e.children.filter((c) => !isBlank(c))
  if (kids.length !== 1 || !isElement(kids[0]) || kids[0].tagName !== 'p') return false
  return kids[0].children.some((c) => {
    if (!isElement(c) || c.tagName !== 'a' || typeof c.properties.href !== 'string' || !isRepoRelative(c.properties.href)) return false
    const path = resolveRepoPath(ctx.source.dir, c.properties.href)
    return path !== undefined && OTHER_README.test(path)
  })
}

function rewriteChildren(parent: Root | Element, ctx: RewriteContext, insideLink: boolean): void {
  const out: (RootContent | ElementContent)[] = []
  for (const child of parent.children) {
    if (!isElement(child)) {
      out.push(child)
      continue
    }
    if (ctx.dropLanguageLink && isLanguageLink(child, ctx)) continue
    if (child.tagName === 'source') continue
    if (child.tagName === 'img') {
      out.push(...rewriteImage(child, ctx, insideLink))
      continue
    }
    if (child.tagName === 'a') rewriteLink(child, ctx)
    rewriteChildren(child, ctx, insideLink || child.tagName === 'a')
    out.push(child)
  }
  parent.children = out as typeof parent.children
}

/** The README, sanitised and rewritten for the project page, with heading ids. */
export function renderReadmeTree(markdown: string, ctx: RewriteContext): Root {
  const tree = sanitizedTree(markdown)
  rewriteChildren(tree, ctx, false)
  return slugger.runSync(tree) as Root
}
