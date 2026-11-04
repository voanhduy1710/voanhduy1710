import type { HeaderData } from '@/lib/content/types'
import { PROFILE_URL, type Nav } from '@/lib/nav'
import type { ActivityLinks } from './ActivityBar'

/** Picks the activity-bar links out of the README header links by their address. */
export function activityLinks(header: Pick<HeaderData, 'links'>, nav: Pick<Nav, 'projects'>, cvHref: string, cvLabel: string): ActivityLinks {
  const find = (test: RegExp) => header.links.find((l) => test.test(l.href))
  return {
    github: find(/^https?:\/\/(www\.)?github\.com\//i)?.href ?? PROFILE_URL,
    linkedin: find(/^https?:\/\/(www\.)?linkedin\.com\//i),
    email: find(/^mailto:/i),
    cv: { label: cvLabel, href: cvHref },
    projectCount: nav.projects.length,
  }
}
