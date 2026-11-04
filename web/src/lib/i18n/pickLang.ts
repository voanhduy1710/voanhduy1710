import type { Lang } from '@/lib/content/types'

export const LANG_COOKIE = 'lang'
export const LANG_COOKIE_MAX_AGE = 31_536_000

/** The highest-q language in an Accept-Language header, as its primary subtag (`vi-VN;q=0.9` -> `vi`); undefined if none. */
export function topAcceptLanguage(header: string | null | undefined): string | undefined {
  let best: { tag: string; q: number } | undefined
  for (const part of (header ?? '').split(',')) {
    const [range, ...params] = part.trim().split(';')
    const tag = range.trim().toLowerCase().split('-')[0]
    if (!/^[a-z]{1,8}$/.test(tag) && tag !== '*') continue
    let q = 1
    for (const p of params) {
      const m = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(p)
      if (m) q = Number.isFinite(Number(m[1])) ? Number(m[1]) : 0
    }
    if (q <= 0 || tag === '*') continue
    if (!best || q > best.q) best = { tag, q }
  }
  return best?.tag
}

/**
 * The language the bare `/` goes to: a valid `lang` cookie, else Vietnam (edge country header), else a browser whose
 * most preferred language is Vietnamese, else English.
 */
export function pickLang({
  cookie,
  country,
  acceptLanguage,
}: {
  cookie?: string | null
  country?: string | null
  acceptLanguage?: string | null
}): Lang {
  if (cookie === 'en' || cookie === 'vi') return cookie
  if (country?.trim().toUpperCase() === 'VN') return 'vi'
  return topAcceptLanguage(acceptLanguage) === 'vi' ? 'vi' : 'en'
}

/** `document.cookie` assignment value remembering the visitor's choice. */
export function langCookie(lang: Lang, secure: boolean): string {
  return `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`
}
