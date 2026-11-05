// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CvDocument } from '@/components/cv/CvDocument'
import { DEFAULT_ACCENT } from '@/lib/cv/accent'
import { ACCENT_VAR, applyAccent, cacheAccent, cachedAccent, clearAccent } from '@/lib/cv/accentStore'
import { loadCvHtml } from '@/lib/cv/html'

const css = readFileSync(join(process.cwd(), 'public/cv/cv.css'), 'utf8').replace(/\r\n/g, '\n')
/** cv.css without its comments */
const code = css.replace(/\/\*[\s\S]*?\*\//g, '')

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const start = code.indexOf(`\n${selector} {`)
  if (start < 0) throw new Error(`no rule ${selector}`)
  const open = code.indexOf('{', start)
  return code.slice(open + 1, code.indexOf('}', open))
}

afterEach(cleanup)

describe('CV accent (one CSS variable in public/cv/cv.css)', () => {
  it('defaults --cv-accent to Pine (= DEFAULT_ACCENT) on :root, and nothing redeclares it (so the owner override on <html> wins)', () => {
    expect(ACCENT_VAR).toBe('--cv-accent')
    expect(rule(':root')).toContain(`--cv-accent: ${DEFAULT_ACCENT};`)
    expect(code.match(/--cv-accent\s*:/g)).toHaveLength(1)
  })

  it('derives every tint from the variable and uses it for header rule, headings, dates, links and bullets', () => {
    const sheet = rule('.cv')
    for (const v of ['--cv-rule', '--cv-soft', '--cv-underline']) {
      expect(sheet).toContain(`${v}: color-mix(in srgb, var(--cv-accent)`)
    }
    expect(rule('.cv > header')).toContain('var(--cv-accent)')
    expect(rule('.cv h2')).toContain('color: var(--cv-accent)')
    expect(rule('.cv .when')).toContain('color: var(--cv-accent)')
    expect(rule('.cv .contact a')).toContain('color: var(--cv-accent)')
    expect(rule('.cv .projects a')).toContain('color: var(--cv-accent)')
    expect(rule('.cv .job li::before,\n.cv .projects li::before,\n.cv .certifications li::before')).toContain('background: var(--cv-accent)')
    // no other hard-coded accent colour
    expect(code.replace(`--cv-accent: ${DEFAULT_ACCENT};`, '').toLowerCase()).not.toContain(DEFAULT_ACCENT)
    expect(code).not.toMatch(/rgba\(31, ?77, ?58/)
  })

  it('project names have no underline; the header contact links keep theirs', () => {
    expect(rule('.cv .projects a')).not.toMatch(/border-bottom|underline/)
    expect(rule('.cv .contact a')).toMatch(/border-bottom: [^;]*var\(--cv-underline\)/)
  })

  it('prints exactly one A4 sheet without the screen guide', () => {
    expect(rule('@page')).toMatch(/size: A4;\s*margin: 0;/)
    const print = code.slice(code.indexOf('@media print'))
    expect(print).toContain('height: 297mm')
    expect(print).toContain('.cv::after { display: none; }')
  })

  it('renders the CV as article.cv (the element the tints are derived on)', () => {
    const { container } = render(<CvDocument cv={loadCvHtml('en')} />)
    expect(container.querySelector('article.cv')).toBeTruthy()
    expect(container.querySelectorAll('.cv h2').length).toBeGreaterThan(3)
  })
})

describe('accentStore', () => {
  it('applies, caches and clears the owner colour', () => {
    applyAccent('#7a2e3a')
    cacheAccent('#7a2e3a')
    expect(document.documentElement.style.getPropertyValue(ACCENT_VAR)).toBe('#7a2e3a')
    expect(cachedAccent()).toBe('#7a2e3a')
    clearAccent()
    expect(document.documentElement.style.getPropertyValue(ACCENT_VAR)).toBe('')
    expect(cachedAccent()).toBeNull()
  })
  it('ignores invalid colours (nothing but #rrggbb reaches the style)', () => {
    window.localStorage.setItem('cv-accent', 'red; background: url(x)')
    expect(cachedAccent()).toBeNull()
    applyAccent('red; x')
    expect(document.documentElement.style.getPropertyValue(ACCENT_VAR)).toBe('')
    window.localStorage.clear()
  })
})
