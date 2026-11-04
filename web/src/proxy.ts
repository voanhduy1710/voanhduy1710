import { NextResponse, type NextRequest } from 'next/server'
import { LANG_COOKIE, pickLang } from '@/lib/i18n/pickLang'

/**
 * Only the bare `/` runs through here (see the matcher); every other route stays static. It sends the visitor to
 * `/en` or `/vi` (cookie, then country, then browser language). Temporary and never cached: it depends on the visitor.
 */
export function proxy(request: NextRequest) {
  const lang = pickLang({
    cookie: request.cookies.get(LANG_COOKIE)?.value,
    country: request.headers.get('x-vercel-ip-country'),
    acceptLanguage: request.headers.get('accept-language'),
  })
  const url = request.nextUrl.clone()
  url.pathname = `/${lang}`
  // Keep the query string (`/?utm_source=x` -> `/en?utm_source=x`).
  url.search = request.nextUrl.search
  const res = NextResponse.redirect(url, 307)
  res.headers.set('Vary', 'Cookie, Accept-Language, x-vercel-ip-country')
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}

export const config = { matcher: ['/'] }
