'use client'

import { usePathname } from 'next/navigation'
import { useLayoutEffect } from 'react'
import { HOME_SECTIONS } from '@/lib/sections'
import { restoreReadingPosition } from './readingPosition'

/**
 * After an EN <-> VI switch, puts the editor pane back at the reader's place (stored by <LangSwitch>) before the new
 * page is painted. Renders nothing.
 */
export function ReadingPositionRestore() {
  const pathname = usePathname()
  useLayoutEffect(() => {
    restoreReadingPosition(HOME_SECTIONS, pathname)
  }, [pathname])
  return null
}
