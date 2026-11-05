'use client'

import { lazy, Suspense, useEffect } from 'react'
import type { Lang } from '@/lib/content/types'
import { hasStoredSession } from '@/lib/auth/client'
import { useAuth } from '@/lib/auth/session'
import { applyAccent, cachedAccent } from '@/lib/cv/accentStore'

const CvAccentControl = lazy(() => import('./CvAccentControl'))

/**
 * Shows the owner's Colour control (a lazy chunk) only when signed in, so public visitors download none of it. With a
 * stored session the cached colour is applied at once, before supabase-js has loaded (the session store clears it
 * again if the session turns out to be invalid).
 */
export function CvAccentGate({ lang }: { lang: Lang }) {
  const auth = useAuth()
  useEffect(() => {
    if (!hasStoredSession()) return
    const cached = cachedAccent()
    if (cached) applyAccent(cached)
  }, [])
  if (auth.status !== 'signedIn') return null
  return (
    <Suspense fallback={null}>
      <CvAccentControl key={auth.userId} lang={lang} userId={auth.userId} />
    </Suspense>
  )
}
