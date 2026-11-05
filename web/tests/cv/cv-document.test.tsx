// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CvDocument } from '@/components/cv/CvDocument'
import { CV_HTML_FILES, loadCvHtml, parseCvHtml } from '@/lib/cv/html'

afterEach(cleanup)

const en = loadCvHtml('en')
const vi = loadCvHtml('vi')

describe('parseCvHtml', () => {
  it('takes the <main class="cv"> sheet and the name from the h1', () => {
    expect(en.name).toBe('Vo Anh Duy')
    expect(vi.name).toBe('Võ Anh Duy')
    expect(en.body).toMatch(/^<header>/)
    expect(en.body).not.toContain('<main')
  })

  it('fails clearly without a sheet', () => {
    expect(() => parseCvHtml('<html><body><p>x</p></body></html>', 'en', 'x.html')).toThrow('x.html: no <main class="cv">')
  })

  it('drops scripts, embeds, comments, on* handlers and javascript: links', () => {
    const cv = parseCvHtml(
      '<main class="cv"><!-- note --><h1 onclick="x()">N</h1><script>alert(1)</script><iframe src="x"></iframe><a href="javascript:alert(1)">a</a><a href="https://ok">b</a></main>',
      'en',
    )
    expect(cv.body).toBe('<h1>N</h1><a>a</a><a href="https://ok">b</a>')
  })

  it('reads the files named in CV_HTML_FILES (public/cv)', () => {
    expect(CV_HTML_FILES).toEqual({ en: 'public/cv/CV_EN.html', vi: 'public/cv/CV_VN.html' })
    expect(readFileSync(join(process.cwd(), CV_HTML_FILES.vi), 'utf8')).toContain('<html lang="vi">')
  })
})

describe('CvDocument (renders the HTML CV)', () => {
  it('renders article.cv with the language, one h1, the sections in order, no images (ATS-friendly)', () => {
    const { container } = render(<CvDocument cv={en} />)
    const sheet = container.querySelector('article.cv')
    expect(sheet?.getAttribute('lang')).toBe('en')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Vo Anh Duy')
    expect(container.querySelectorAll('img, svg, canvas, main')).toHaveLength(0)
    expect([...container.querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
      'Summary',
      'Experience',
      'Projects',
      'Skills',
      'Education',
      'Languages',
      'Certifications',
    ])
  })

  it('keeps the links: contact words, project pages, certificates', () => {
    const { container } = render(<CvDocument cv={en} />)
    expect([...container.querySelectorAll('.contact a')].map((a) => a.textContent)).toEqual(['Email', 'Website', 'GitHub', 'LinkedIn'])
    expect(container.querySelector('a[href="mailto:voanhduy1710@gmail.com"]')).toBeTruthy()
    expect(container.querySelectorAll('.projects a[href^="https://voanhduy1710.vercel.app/en/projects/"]')).toHaveLength(4)
    expect(container.querySelectorAll('.certifications li a')).toHaveLength(7)
  })

  it('renders the Vietnamese CV with Vietnamese headings and /vi/ project pages', () => {
    const { container } = render(<CvDocument cv={vi} />)
    expect(container.querySelector('article.cv')?.getAttribute('lang')).toBe('vi')
    expect(container.querySelector('h2')?.textContent).toBe('Giới thiệu')
    expect(container.querySelectorAll('.projects a[href^="https://voanhduy1710.vercel.app/vi/projects/"]')).toHaveLength(4)
    expect(container.querySelectorAll('.job')).toHaveLength(3)
  })
})
