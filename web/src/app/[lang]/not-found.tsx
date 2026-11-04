'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isLang } from '@/lib/i18n/paths'
import { ui } from '@/lib/i18n/ui'

// not-found receives no params: the language is read from the URL.
export default function NotFound() {
  const segment = usePathname().split('/')[1] ?? ''
  const lang = isLang(segment) ? segment : 'en'
  const t = ui(lang)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="font-mono text-5xl text-vsc-muted">404</p>
      <p className="text-vsc-heading">{t.notFound}</p>
      <Link href={`/${lang}`} className="text-sm text-vsc-link hover:underline">
        {t.backHome}
      </Link>
    </div>
  )
}
