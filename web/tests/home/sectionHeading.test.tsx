// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HomeSection } from '@/components/home/HomeSection'

afterEach(cleanup)

const EXPECTED = [
  ['experience', 'briefcase', '#f97316'],
  ['skills', 'book', '#a855f7'],
  ['projects', 'archive', '#eab308'],
  ['contact', 'envelope', '#60a5fa'],
] as const

describe('home section headings', () => {
  it.each(EXPECTED)('%s: %s icon with its glow, then the one h2', (id, icon, glow) => {
    const { container } = render(
      <HomeSection id={id} title={`Title ${id}`}>
        <p>body</p>
      </HomeSection>,
    )
    const iconEl = container.querySelector(`[data-section-icon="${icon}"]`)
    expect(iconEl).not.toBeNull()
    expect(iconEl!.querySelector('svg')).not.toBeNull()
    const glowEl = iconEl!.querySelector('.section-glow') as HTMLElement
    expect(glowEl.getAttribute('aria-hidden')).not.toBeNull()
    expect(glowEl.className).toMatch(/-inset-2 -z-10 rounded-full/)
    expect(glowEl.style.backgroundColor).toBe(
      `rgb(${[1, 3, 5].map((i) => parseInt(glow.slice(i, i + 2), 16)).join(', ')})`,
    )
    const h2s = container.querySelectorAll('h2')
    expect(h2s).toHaveLength(1)
    expect(h2s[0].textContent).toBe(`Title ${id}`)
    // icon comes before the heading text in the row
    expect(iconEl!.nextElementSibling).toBe(h2s[0])
  })

  it('the hero (about) has no icon', () => {
    const { container } = render(<HomeSection id="about" title="Hi">x</HomeSection>)
    expect(container.querySelector('[data-section-icon]')).toBeNull()
  })

  it('without IntersectionObserver (or already in view) the row is never hidden', () => {
    const { container } = render(<HomeSection id="skills" title="Skills">x</HomeSection>)
    expect(container.querySelector('.section-reveal')!.getAttribute('data-reveal')).toBeNull()
  })
})
