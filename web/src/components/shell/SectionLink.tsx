'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps } from 'react'
import { sectionHref, type HomeSectionId } from '@/lib/sections'
import { isPlainClick } from './mouse'
import { scrollToSection, setPendingSection } from './sectionScroll'
import { openTab } from './useOpenTabs'

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'onClick'> & {
  lang: string
  section: HomeSectionId
  /** Runs after a plain click (e.g. close the mobile sidebar). */
  onPlainClick?: () => void
}

/**
 * Link to a section of the home page (`/{lang}#<id>`). On the home page a plain click scrolls the editor pane to it
 * (no route navigation); elsewhere it navigates home, which then scrolls to the section. Either way the home tab
 * opens. Modified clicks are left to the browser.
 */
export function SectionLink({ lang, section, onPlainClick, ...props }: Props) {
  const pathname = usePathname()
  const onHome = pathname.replace(/\/$/, '') === `/${lang}`
  return (
    <Link
      {...props}
      href={sectionHref(lang, section)}
      onClick={(e) => {
        if (!isPlainClick(e)) return
        openTab('home')
        onPlainClick?.()
        if (onHome) {
          e.preventDefault()
          scrollToSection(section)
        } else {
          setPendingSection(section)
        }
      }}
    />
  )
}
