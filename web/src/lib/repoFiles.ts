/**
 * The project's config files shown in the explorer's root folder and opened read-only in a code view at
 * `/{lang}/files/<slug>`. This list is the whole allow-list: no other file is ever read for display (never `.env*`).
 * No imports, so the sync script, the nav model (client) and the page (server) can all use it.
 */

/** How the code view colours a file. */
export type RepoFileSyntax = 'ignore' | 'json' | 'ts'

/** The explorer / tab icon of a config file. */
export type RepoFileIcon = 'git' | 'vercel' | 'nextjs' | 'npm' | 'tsconfig'

export type RepoFile = {
  /** URL segment: the file name, minus the leading dot of a dotfile. */
  slug: string
  /** The file's real name, shown in the explorer, the tab and the breadcrumb. */
  name: string
  syntax: RepoFileSyntax
  icon: RepoFileIcon
  /**
   * Where the build reads it from, relative to the website folder `web/`. The repo-root `.gitignore` is outside the
   * Vercel upload (only `web/` is uploaded), so the content sync copies it into `content/` first.
   */
  path: string
}

/** The synced copy of the profile repo's root `.gitignore`, relative to `content/` (not a dotfile, so no tool reads it as one). */
export const SYNCED_GITIGNORE = 'repo-files/gitignore'

/** Files the content sync copies from the profile repo root: `[path in the repo, path under content/]`. */
export const SYNCED_REPO_FILES: readonly (readonly [string, string])[] = [['.gitignore', SYNCED_GITIGNORE]]

/** In the order VS Code lists them: dotfiles first, then by name. */
export const REPO_FILES: readonly RepoFile[] = [
  { slug: 'gitignore', name: '.gitignore', syntax: 'ignore', icon: 'git', path: `content/${SYNCED_GITIGNORE}` },
  { slug: 'vercelignore', name: '.vercelignore', syntax: 'ignore', icon: 'vercel', path: '.vercelignore' },
  { slug: 'next.config.ts', name: 'next.config.ts', syntax: 'ts', icon: 'nextjs', path: 'next.config.ts' },
  { slug: 'package.json', name: 'package.json', syntax: 'json', icon: 'npm', path: 'package.json' },
  { slug: 'tsconfig.json', name: 'tsconfig.json', syntax: 'json', icon: 'tsconfig', path: 'tsconfig.json' },
]

/** The allow-listed file for a URL segment; undefined for anything else (`.env`, `../x`, a typo). */
export function repoFileBySlug(slug: string): RepoFile | undefined {
  return REPO_FILES.find((f) => f.slug === slug)
}

export const repoFileHref = (lang: string, file: RepoFile) => `/${lang}/files/${file.slug}`
