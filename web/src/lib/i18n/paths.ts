import { LANGS, type Lang } from '@/lib/content/types'

export const isLang = (value: string): value is Lang => (LANGS as readonly string[]).includes(value)

/** Same page in the other language: replaces the first path segment (`/en/projects/caro-app` -> `/vi/projects/caro-app`). */
export function switchLang(pathname: string, to: Lang): string {
  const rest = pathname.replace(/^\/[^/]*/, '')
  return `/${to}${rest === '/' ? '' : rest}`
}

/** The language the EN | VI switch toggles to. */
export const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'vi' : 'en')

/** Absolute base of the site, for `<link rel="alternate">` and other metadata URLs. */
export const SITE_URL = 'https://voanhduy1710.vercel.app'

/**
 * `alternates` metadata of a page: the same page in every language (hreflang). The home page (`rest` = `''`) also
 * gets `x-default` = the bare `/`, which picks a language by visitor; deeper pages have no language-neutral URL, so
 * they list only en + vi. `rest` is the path after the language (`''`, `/cv`, `/projects/caro-app`).
 */
export function languageAlternates(rest: string) {
  const languages: Record<string, string> = {}
  for (const l of LANGS) languages[l] = `/${l}${rest}`
  if (rest === '') languages['x-default'] = '/'
  return { languages }
}
