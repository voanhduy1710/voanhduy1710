'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { LANGS, type Lang } from '@/lib/content/types'
import { otherLang, switchLang } from '@/lib/i18n/paths'
import { langCookie } from '@/lib/i18n/pickLang'
import { HOME_SECTIONS } from '@/lib/sections'
import { isPlainClick } from './mouse'
import { saveReadingPosition } from './readingPosition'

/**
 * The EN | VI switch: one link to the same page in the other language. Clicking anywhere on it toggles;
 * the active side stays highlighted. The other-language page is prefetched in full once the browser is idle, so the
 * switch needs no network wait, and the reader's place is stored for it (see readingPosition.ts).
 */
export function LangSwitch({
  lang,
  switchToEn,
  switchToVi,
  onNavigate,
  className = '',
}: {
  lang: Lang
  switchToEn: string
  switchToVi: string
  onNavigate?: () => void
  className?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const target = otherLang(lang)
  const href = switchLang(pathname, target)
  useEffect(() => {
    const prefetch = () => router.prefetch(href)
    // Highest preload priority (ahead of the background queue, see PreloadScheduler): a short idle timeout, so on a
    // slow link the request is queued right after the page settles, not up to 2 s later.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetch, { timeout: 300 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(prefetch, 50)
    return () => window.clearTimeout(id)
  }, [router, href])
  return (
    <Link
      href={href}
      prefetch
      hrefLang={target}
      role={onNavigate ? 'menuitem' : undefined}
      aria-label={target === 'en' ? switchToEn : switchToVi}
      onClick={(e) => {
        // Remember the choice for the bare `/` (see proxy.ts).
        document.cookie = langCookie(target, window.location.protocol === 'https:')
        if (isPlainClick(e)) saveReadingPosition(href, HOME_SECTIONS)
        onNavigate?.()
      }}
      className={`inline-flex cursor-pointer overflow-hidden rounded-[5px] border border-[#3c3c3c] text-[0.625rem] hover:border-[#6b6b6b] ${className}`}
    >
      {LANGS.map((l) => (
        <span
          key={l}
          aria-hidden
          className={`px-[0.42rem] py-[0.1rem] uppercase ${l === lang ? 'bg-vsc-accent text-white' : 'text-[#9d9d9d]'}`}
        >
          {l}
        </span>
      ))}
    </Link>
  )
}
