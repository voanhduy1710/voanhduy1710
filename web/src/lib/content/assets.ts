import type { Nodes } from 'mdast'
import { decodeAssetPath, decodeEntities, htmlImages, toMdast } from './mdast'

const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|avif|pdf)$/i
/** `http:`, `mailto:`, `data:`... or protocol-relative `//host`; `#anchors` are not files either. */
const NOT_RELATIVE = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i
const A_HREF = /<a\b[^>]*?\bhref\s*=\s*"([^"]*)"/gi

function urlsOf(node: Nodes, out: string[]): void {
  if (node.type === 'image' || node.type === 'link' || node.type === 'definition') out.push(node.url)
  if (node.type === 'html') {
    out.push(...htmlImages(node.value).flatMap(({ attrs }) => (attrs.src ? [attrs.src] : [])))
    out.push(...[...node.value.matchAll(A_HREF)].map((m) => decodeEntities(m[1])))
  }
  if ('children' in node) for (const child of node.children) urlsOf(child, out)
}

/**
 * Every README-relative image / PDF the markdown references (`<img src>`, `<a href>`, `![](...)`, `[](...)`),
 * URI-decoded and deduped in first-seen order. Absolute URLs (`http(s):`, `mailto:`...) are excluded.
 */
export function referencedAssets(markdown: string, file = 'README.md'): string[] {
  const urls: string[] = []
  urlsOf(toMdast(markdown), urls)
  const assets = urls
    .map((u) => u.trim().replace(/[?#].*$/, ''))
    .filter((u) => u !== '' && !NOT_RELATIVE.test(u))
    .map((u) => decodeAssetPath(u, file, 'assets'))
    .filter((p) => ASSET_EXT.test(p))
  return [...new Set(assets)]
}

/** README paths under this prefix are files in the website's own `public/` folder, served from the site root. */
export const SITE_PUBLIC_PREFIX = 'web/public/'

/**
 * Served URL of a README-relative (decoded) asset path:
 * `web/public/logos/Google Cloud Run.png` -> `/logos/Google%20Cloud%20Run.png` (the site's own public folder);
 * anything else, e.g. `CV_Vo Anh Duy_EN.pdf` -> `/content/CV_Vo%20Anh%20Duy_EN.pdf` (copied by the sync).
 */
export function assetUrl(readmePath: string): string {
  if (readmePath.startsWith(SITE_PUBLIC_PREFIX)) return '/' + encodeURI(readmePath.slice(SITE_PUBLIC_PREFIX.length))
  return '/content/' + encodeURI(readmePath)
}
