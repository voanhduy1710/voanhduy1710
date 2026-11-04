/**
 * The home page (`src/app/[lang]/page.tsx`) is one scrolling page of sections. This module has no imports, so `next.config.ts`
 * can use it for the redirects of the old per-section routes.
 */

/** Section ids of the home page, in page order. `about` is the hero. */
export const HOME_SECTIONS = ['about', 'experience', 'skills', 'projects', 'contact'] as const

export type HomeSectionId = (typeof HOME_SECTIONS)[number]

/** In-page link to a section of a language's home page. */
export const sectionHref = (lang: string, id: HomeSectionId) => `/${lang}#${id}`

/** A location hash (`#skills` or `skills`) as a section id; undefined for anything else. */
export function sectionFromHash(hash: string): HomeSectionId | undefined {
  const id = hash.replace(/^#/, '')
  return (HOME_SECTIONS as readonly string[]).includes(id) ? (id as HomeSectionId) : undefined
}

/** The sections that used to be pages of their own (`/{lang}/about`, `/{lang}/skills` …): all of them. */
const OLD_ROUTES = HOME_SECTIONS

/**
 * next.config redirects so old links keep working (temporary): `/{lang}/<id>` -> `/{lang}#<id>`, except the old
 * About page, which is the top of the home page itself: `/{lang}/about` -> `/{lang}`.
 */
export function sectionRedirects(langs: readonly string[]) {
  return OLD_ROUTES.map((id) => ({
    source: `/:lang(${langs.join('|')})/${id}`,
    destination: id === 'about' ? '/:lang' : `/:lang#${id}`,
    permanent: false,
  }))
}

/** Where a section counts as "in view": its top has scrolled above this fraction of the pane height. */
const READING_LINE = 1 / 3

/**
 * Scroll-spy: the section being read. `tops` are section tops relative to the top of the scroll pane, in page
 * order. It is the last section whose top is above the reading line, the first one before any is, and the last one
 * once the pane is scrolled to the bottom (a short final section may never reach the line).
 */
export function activeSection<Id extends string>(
  tops: readonly { id: Id; top: number }[],
  pane: { height: number; atBottom: boolean },
): Id | undefined {
  if (tops.length === 0) return undefined
  if (pane.atBottom) return tops[tops.length - 1].id
  const line = pane.height * READING_LINE
  let active = tops[0].id
  for (const s of tops) if (s.top <= line) active = s.id
  return active
}
