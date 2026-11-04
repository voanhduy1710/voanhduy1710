// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectsSection } from '@/components/home/ProjectsSection'
import type { SiteContent } from '@/lib/content'

afterEach(cleanup)

const project = (slug: string, group: string, images: { src: string; alt: string }[]): SiteContent['projects'][number] => ({
  slug,
  group,
  title: `Title ${slug}`,
  repoUrl: `https://github.com/o/${slug}`,
  badges: [],
  description: [],
  bullets: [],
  images,
})

const BI_COVER =
  '/content/project-readmes/data-analyst-portfolio/1.%20Preview%20Atino%20Data%20model.png.webp'

describe('ProjectsSection card thumbnails', () => {
  it('uses the profile preview, else the first README image, else the placeholder', () => {
    const readmeCover = vi.fn((slug: string) => (slug === 'data-analyst-portfolio' ? BI_COVER : undefined))
    const { container } = render(
      <ProjectsSection
        title="Projects"
        lang="en"
        readmeCover={readmeCover}
        projects={[
          project('caro-app', 'My works', [{ src: 'web/public/previews/Caro-app/Preview_1.png', alt: 'Caro 1' }]),
          project('data-analyst-portfolio', 'Data Analytics & Business Intelligence', []),
          project('no-images', 'My works', []),
        ]}
      />,
    )
    const card = (slug: string) => container.querySelector(`a[href="/en/projects/${slug}"]`)!
    const src = (slug: string) => decodeURIComponent(card(slug).querySelector('img')?.getAttribute('src') ?? '')

    expect(src('caro-app')).toContain('/previews/Caro-app/Preview_1.png')
    // next/image wraps it: /_next/image?url=<encoded>, so one decode gives the served URL back.
    expect(src('data-analyst-portfolio')).toContain(`url=${BI_COVER}&`)
    expect(card('data-analyst-portfolio').querySelector('img')?.getAttribute('alt')).toBe('Title data-analyst-portfolio')
    expect(card('no-images').querySelector('img')).toBeNull()
    expect(card('no-images').textContent).toContain('no-images.md')
    // A profile preview wins: the README is not consulted for projects that have one.
    expect(readmeCover).not.toHaveBeenCalledWith('caro-app')
  })
})
