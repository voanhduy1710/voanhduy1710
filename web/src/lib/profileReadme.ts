import { readFileSync } from 'node:fs'
import { contentPath } from './contentDir'
import { assetUrl } from './content/assets'
import { README_FILES } from './content/index'
import type { Lang } from './content/types'
import { profileReadmeHref } from './nav'
import { cachedBySyncedFiles } from './syncedCache'

/**
 * The profile README (the repo's own `README.md` on /en, `READMEVN.md` on /vi) shown in-site as a markdown preview at
 * `/{lang}/readme`, the page the explorer's README row opens. Rendered by the project README renderer (same sanitiser);
 * this module only says where its repo-relative images and links go.
 */

/** The profile repo (where README.md / READMEVN.md live); used to resolve the README's repo-relative paths. */
export const PROFILE_REPO_URL = 'https://github.com/voanhduy1710/voanhduy1710'

export { profileReadmeHref }

/** Files the content sync copies to `public/content/` (or that the site serves from `web/public/`). */
const ASSET = /\.(png|jpe?g|gif|svg|webp|avif|pdf)$/i
const README_OF: Record<string, Lang> = { 'readme.md': 'en', 'readmevn.md': 'vi' }

/**
 * Served URL of a repo-relative image of the profile README: `web/public/logos/Google Cloud Run.png` ->
 * `/logos/Google%20Cloud%20Run.png` (the site's own public folder), other image files -> the synced `/content/...`
 * copy. Anything else is dropped.
 */
export function profileReadmeImageUrl(path: string): string | undefined {
  return ASSET.test(path) ? assetUrl(path) : undefined
}

/**
 * Where a repo-relative link of the profile README goes: `README.md` / `READMEVN.md` -> that language's in-site
 * preview, a PDF / image (the CV) -> its synced `/content/...` copy (or `web/public/X` -> `/X`); anything else has no
 * page on the site, so it is plain text (`null`). Absolute links (the project repos on GitHub) are not affected.
 */
export function profileReadmeLinkTarget(path: string): string | null {
  const readme = README_OF[path.toLowerCase()]
  if (readme) return profileReadmeHref(readme)
  return ASSET.test(path) ? assetUrl(path) : null
}

const loadPair = cachedBySyncedFiles(
  () => [contentPath(README_FILES.en), contentPath(README_FILES.vi)],
  (): Record<Lang, string> => ({
    en: readFileSync(contentPath(README_FILES.en), 'utf8'),
    vi: readFileSync(contentPath(README_FILES.vi), 'utf8'),
  }),
)

/** The synced profile README text for `lang` (`content/README.md` or `content/READMEVN.md`). */
export function loadProfileReadme(lang: Lang): string {
  return loadPair()[lang]
}
