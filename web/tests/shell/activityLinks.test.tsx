// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityBar } from '@/components/shell/ActivityBar'
import { activityLinks } from '@/components/shell/activityLinks'
import { SidebarProvider } from '@/components/shell/SidebarState'
import { PROFILE_URL } from '@/lib/nav'

vi.mock('next/navigation', () => ({ usePathname: () => '/en', useRouter: () => ({ prefetch: () => {}, push: () => {} }) }))

const header = {
  links: [
    { label: 'Website', href: 'https://voanhduy1710.vercel.app' },
    { label: 'GitHub', href: 'https://github.com/someone-else' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/x' },
    { label: 'Email', href: 'mailto:a@b.co' },
  ],
}
const labels = {
  bar: 'Thanh hoạt động',
  explorer: 'Explorer',
  search: 'Search',
  sourceControl: 'Source Control',
  runDebug: 'Run',
  extensions: 'Extensions',
  github: 'GitHub',
  accounts: 'Accounts',
  settings: 'Settings',
  language: 'Language',
  switchToEn: 'English',
  switchToVi: 'Tiếng Việt',
}

afterEach(cleanup)

describe('activityLinks', () => {
  it('takes the GitHub, LinkedIn and email links from the README header', () => {
    const links = activityLinks(header, { projects: [] }, '/content/cv.pdf', 'Download CV')
    expect(links.github).toBe('https://github.com/someone-else')
    expect(links.linkedin?.href).toBe('https://www.linkedin.com/in/x')
    expect(links.email?.href).toBe('mailto:a@b.co')
  })

  it('falls back to the profile URL without a GitHub link', () => {
    expect(activityLinks({ links: [] }, { projects: [] }, '/cv', 'CV').github).toBe(PROFILE_URL)
  })
})

describe('ActivityBar GitHub item', () => {
  it('sits right below Extensions and links to the README GitHub profile in a new tab', () => {
    const links = activityLinks(header, { projects: [] }, '/content/cv.pdf', 'Download CV')
    render(
      <SidebarProvider>
        <ActivityBar lang="en" links={links} labels={labels} />
      </SidebarProvider>,
    )
    const github = screen.getByRole('link', { name: 'GitHub' })
    expect(github.getAttribute('href')).toBe('https://github.com/someone-else')
    expect(github.getAttribute('target')).toBe('_blank')
    expect(github.getAttribute('rel')).toBe('noopener noreferrer')
    expect(github.previousElementSibling?.getAttribute('aria-label')).toBe('Extensions')
    // Source Control is unchanged and uses the same source.
    expect(screen.getByRole('link', { name: 'Source Control' }).getAttribute('href')).toBe('https://github.com/someone-else')
  })

  it('takes its own accessible name from the labels (ui.ts, en/vi)', () => {
    const links = activityLinks(header, { projects: [] }, '/content/cv.pdf', 'Download CV')
    const { container } = render(
      <SidebarProvider>
        <ActivityBar lang="vi" links={links} labels={labels} />
      </SidebarProvider>,
    )
    expect(container.querySelector('[aria-label="Thanh hoạt động"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Activity bar"]')).toBeNull()
  })
})
