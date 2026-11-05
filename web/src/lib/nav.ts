import { inlineText } from '@/lib/content/inline'
import type { Badge, Certification, Inline, Lang } from '@/lib/content/types'
import { certificateHref } from '@/lib/certificates'
import { splitGroups } from '@/lib/projectGroups'
import { ui } from '@/lib/i18n/ui'
import { REPO_FILES, repoFileHref, type RepoFileIcon } from '@/lib/repoFiles'
import { sectionHref, type HomeSectionId } from '@/lib/sections'

/** Icons a page can carry in the explorer, the tab strip and OPEN EDITORS. */
export type NavIcon =
  | 'star'
  | 'experience'
  | 'skills'
  | 'projects'
  | 'contact'
  | 'pdf'
  | 'react'
  | 'nestjs'
  | 'typescript'
  | 'fastapi'
  | 'python'
  | 'powerbi'
  | 'sql'
  | 'appsscript'
  | 'excel'
  | 'file'
  | 'markdown'
  | RepoFileIcon

/**
 * One page of the site, as an editor tab. `id` is language-neutral (open tabs survive the EN/VI switch);
 * `fileName` is the file the page "lives in", used for the status bar's language mode.
 */
export type NavPage = { id: string; label: string; href: string; icon: NavIcon; fileName: string }

/** A section of the home page: a row in `public/`. Clicking it scrolls; it has no tab of its own. */
export type NavSection = { id: HomeSectionId; label: string; href: string; icon: NavIcon }

/** A row of `src/Certifications`: with a synced PDF it opens the PDF's page (`page`). */
export type NavCertification = Certification & { page?: NavPage }

/** A row of `src/BI projects`: an analysis with its own page (or, without analyses, a project page). */
export type NavRow = { key: string; label: string; page: NavPage }

/**
 * The explorer tree: `public/` with one row per home section, `src/` with `My works`, `BI projects` and
 * `Certifications`, then the root files (config files, cv.pdf, README.md).
 */
export type Nav = {
  /** The home page: one tab, "About Me", shared by all its sections. */
  home: NavPage
  /** Rows of `public/`, in page order: About Me (hero), Work Experience, Skills, Projects, Contact Me. */
  sections: NavSection[]
  /** Every project page, in README order (tabs, and the Source Control badge count). */
  projects: NavPage[]
  /** `src/My works`: every project outside the analytics group. */
  works: NavPage[]
  /**
   * `src/BI projects`: one row per analysis (each its own page, from the analytics project's README sections); an
   * analytics project without synced analyses gets one row for its page.
   */
  bi: NavRow[]
  /** The analysis pages behind the BI rows (tabs), in README order. */
  analyses: NavPage[]
  /**
   * `src/Certifications`: a row with a PDF opens its page (an editor tab); otherwise a link opens in a new browser
   * tab, and without either the row is only text plus its status.
   */
  certifications: NavCertification[]
  cv: NavPage
  /** Config files at the bottom of the root folder, each a read-only code view. */
  files: NavPage[]
  /**
   * The profile README as an in-site markdown preview (`/{lang}/readme`): `README.md` on /en, `READMEVN.md` on /vi
   * (the row and tab are named after the file that language shows).
   */
  readme: NavPage
}

export const PROFILE_URL = 'https://github.com/voanhduy1710'

/** The profile README file each language shows (the same names as the content loader's README_FILES). */
export const PROFILE_README_FILES: Record<Lang, string> = { en: 'README.md', vi: 'READMEVN.md' }

/** The in-site preview of the profile README. */
export const profileReadmeHref = (lang: Lang) => `/${lang}/readme`

/** Tech icons for project rows, most specific framework first (so NestJS beats React, FastAPI beats Python). */
const TECH_PRIORITY: [NavIcon, RegExp][] = [
  ['nestjs', /^nest\s*js$/],
  ['fastapi', /^fast\s*api$/],
  ['powerbi', /^power\s*bi$/],
  ['react', /^react$/],
  ['typescript', /^typescript$/],
  ['python', /^python$/],
]

/** A project's explorer icon, picked from its README badges (label or alt text); a plain file icon if none match. */
export function projectIcon(badges: Pick<Badge, 'label' | 'alt'>[]): NavIcon {
  const names = badges.flatMap((b) => [b.label, b.alt ?? '']).map((n) => n.replace(/[_-]/g, ' ').trim().toLowerCase())
  for (const [icon, test] of TECH_PRIORITY) if (names.some((n) => test.test(n))) return icon
  return 'file'
}

/** The bold lead of a bullet (`**Uber Trip Analytics:** ...` -> `Uber Trip Analytics`), if it has one. */
export function bulletTitle(bullet: Inline[]): string | undefined {
  const first = bullet.find((i) => !(i.kind === 'text' && i.value.trim() === ''))
  if (first?.kind !== 'strong') return undefined
  const title = inlineText(first.children).trim().replace(/\s*:$/, '').trim()
  return title || undefined
}

export type NavProject = {
  slug: string
  title: string
  badges: Pick<Badge, 'label' | 'alt'>[]
  /** README group heading (`### ...`); the projects' order of appearance decides which group is which. */
  group?: string
  bullets?: Inline[][]
  /**
   * Analytics projects: the analyses its own README lists (`### 3. Uber Trips` -> `uber-trips`), each opening
   * `/{lang}/projects/<slug>/<analysis>` (see lib/projectAnalyses.ts).
   */
  analyses?: { slug: string; title: string; icon?: NavIcon }[]
}

/** Tab id of an analysis page: `analysis:<project slug>/<analysis slug>`. */
export const analysisPageId = (project: string, analysis: string) => `analysis:${project}/${analysis}`

/**
 * BI rows: one per analysis of each analytics project that has them (its own page); otherwise the old rule: one per
 * titled bullet of a lone analytics project (all opening its page), else one per project.
 */
function biRows(analytics: { project: NavProject; page: NavPage; analyses: NavPage[] }[]): NavRow[] {
  if (analytics.some((a) => a.analyses.length > 0)) {
    return analytics.flatMap(({ page, analyses }) =>
      analyses.length > 0 ? analyses.map((a) => ({ key: a.id, label: a.label, page: a })) : [{ key: page.id, label: page.label, page }],
    )
  }
  if (analytics.length === 1) {
    const { project, page } = analytics[0]
    const titles = (project.bullets ?? []).map(bulletTitle).filter((t): t is string => t !== undefined)
    if (titles.length > 0) return titles.map((label, i) => ({ key: `${page.id}#${i}`, label, page }))
  }
  return analytics.map(({ page }) => ({ key: page.id, label: page.label, page }))
}

/**
 * The CV row's file name: the last path segment of the README's CV link for this language, decoded
 * (`/content/CV_Vo%20Anh%20Duy_EN.pdf` -> `CV_Vo Anh Duy_EN.pdf`); `cv.pdf` if there is none.
 */
export function cvFileName(cvHref: string | undefined): string {
  const last = cvHref?.split(/[?#]/)[0].split('/').pop()
  if (!last) return 'cv.pdf'
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

/**
 * `pdfs`: the certificate numbers whose PDF the content sync downloaded. `cvHref`: the README's CV link for `lang`,
 * which names the CV row (it still opens the `/{lang}/cv` page).
 */
export function buildNav(
  lang: Lang,
  projects: NavProject[],
  certifications: Certification[] = [],
  pdfs: ReadonlySet<number> = new Set(),
  cvHref?: string,
): Nav {
  const cvFile = cvFileName(cvHref)
  const t = ui(lang)
  const root = `/${lang}`
  const section = (id: HomeSectionId, label: string, icon: NavIcon): NavSection => ({ id, label, href: sectionHref(lang, id), icon })
  const pageOf = (p: NavProject): NavPage => ({
    id: `project:${p.slug}`,
    label: p.title,
    href: `${root}/projects/${p.slug}`,
    icon: projectIcon(p.badges),
    fileName: `${p.slug}.md`,
  })
  const pages = new Map(projects.map((p) => [p.slug, pageOf(p)]))
  const { works, analytics } = splitGroups(projects)
  const analysisPages = (p: NavProject): NavPage[] =>
    (p.analyses ?? []).map((a) => ({
      id: analysisPageId(p.slug, a.slug),
      label: a.title,
      href: `${root}/projects/${p.slug}/${a.slug}`,
      icon: a.icon ?? 'powerbi',
      fileName: `${a.slug}.md`,
    }))
  const bi = analytics.map((project) => ({ project, page: pages.get(project.slug)!, analyses: analysisPages(project) }))
  return {
    // The home page is a React page component: `{ } TypeScript JSX` in the status bar.
    home: { id: 'home', label: t.navAbout, href: root, icon: 'star', fileName: 'page.tsx' },
    sections: [
      section('about', t.navAbout, 'star'),
      section('experience', t.navExperience, 'experience'),
      section('skills', t.navSkills, 'skills'),
      section('projects', t.navProjects, 'projects'),
      section('contact', t.navContact, 'contact'),
    ],
    projects: [...pages.values()],
    works: works.map((p) => pages.get(p.slug)!),
    bi: biRows(bi),
    analyses: bi.flatMap((b) => b.analyses),
    certifications: certifications.map((c) =>
      pdfs.has(c.no)
        ? {
            ...c,
            page: { id: `cert:${c.no}`, label: c.name, href: certificateHref(lang, c.no), icon: 'pdf', fileName: `${c.name}.pdf` },
          }
        : c,
    ),
    cv: { id: 'cv', label: cvFile, href: `${root}/cv`, icon: 'pdf', fileName: cvFile },
    files: REPO_FILES.map((f) => ({ id: `file:${f.slug}`, label: f.name, href: repoFileHref(lang, f), icon: f.icon, fileName: f.name })),
    readme: {
      id: 'readme',
      label: PROFILE_README_FILES[lang],
      href: profileReadmeHref(lang),
      icon: 'markdown',
      fileName: PROFILE_README_FILES[lang],
    },
  }
}

/**
 * The root files below the folders, in the owner's order: the CV, README.md, then the config files in VS Code's
 * file order (`.gitignore`, `.vercelignore`, `next.config.ts`, `package.json`, `tsconfig.json`).
 */
export function orderRootFiles<T>(cv: T, readme: T, files: readonly { name: string; item: T }[]): T[] {
  return [cv, readme, ...[...files].sort((a, b) => compareFileNames(a.name, b.name)).map((f) => f.item)]
}

/** VS Code's explorer order for the files of one folder: dotfiles first, then by name, ignoring case. */
export function compareFileNames(a: string, b: string): number {
  const rank = (n: string) => (n.startsWith('.') ? 0 : 1)
  if (rank(a) !== rank(b)) return rank(a) - rank(b)
  const [x, y] = [a.toLowerCase(), b.toLowerCase()]
  return x < y ? -1 : x > y ? 1 : 0
}

/** Every page that can be opened as a tab, in explorer order. */
export function navPages(nav: Nav): NavPage[] {
  const certificates = nav.certifications.flatMap((c) => (c.page ? [c.page] : []))
  return [nav.home, ...nav.projects, ...nav.analyses, ...certificates, nav.cv, nav.readme, ...nav.files]
}

/** The page whose href is the given pathname (trailing slash ignored). */
export function findNavPage(nav: Nav, pathname: string): NavPage | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  return navPages(nav).find((f) => f.href === path)
}

/** Explorer folders that start collapsed (`src/` and `My works` start open). */
export const COLLAPSED_BY_DEFAULT: readonly string[] = ['bi', 'certifications']

/**
 * Whether a folder is open: the user's toggle if there is one, else its default. `revealed` (the folder holds the
 * page being shown) opens a collapsed-by-default folder, as VS Code reveals the active file.
 */
export const isFolderOpen = (key: string, open: Readonly<Record<string, boolean>>, revealed = false): boolean =>
  open[key] ?? (revealed || !COLLAPSED_BY_DEFAULT.includes(key))
