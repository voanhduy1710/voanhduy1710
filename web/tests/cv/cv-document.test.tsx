// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CvDocument } from '@/components/cv/CvDocument'
import { CV_FILES, parseCv, type CvModel } from '@/lib/cv'

// jsdom gives `import.meta.url` an http: scheme, so the files are found from the package root (vitest's cwd).
const load = (lang: 'en' | 'vi') => parseCv(readFileSync(join(process.cwd(), CV_FILES[lang]), 'utf8'), lang, CV_FILES[lang])
const en = load('en')
const vi = load('vi')

afterEach(cleanup)

describe('CvDocument', () => {
  it('renders the name, title, experience and contact line from the EN YAML', () => {
    const { container } = render(<CvDocument cv={en} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Vo Anh Duy')
    expect(screen.getByText('Data Specialist & Technical Developer')).toBeTruthy()
    expect(screen.getByText('Atino Fashion Co., Ltd.')).toBeTruthy()
    const contact = container.querySelector('.cv-contact')?.textContent ?? ''
    expect(contact).toContain('+84 978 987 889')
    expect(contact).toContain('voanhduy1710@gmail.com')
    expect(contact).toContain('github.com/voanhduy1710')
    expect(contact).toContain('linkedin.com/in/voanhduy1710')
    expect(container.querySelector('a[href="mailto:voanhduy1710@gmail.com"]')).toBeTruthy()
  })

  it('is ATS-friendly: real text, no images, one h1, standard section headings in order', () => {
    const { container } = render(<CvDocument cv={en} />)
    expect(container.querySelectorAll('img, svg, canvas')).toHaveLength(0)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect([...container.querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
      'Summary',
      'Skills',
      'Experience',
      'Projects',
      'Education',
      'Certifications',
      'Languages',
    ])
  })

  it('renders every section: skills, bold bullets, projects with tech, education, certifications, languages', () => {
    const { container } = render(<CvDocument cv={en} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Full-Stack Development: TypeScript, JavaScript, React')
    expect(container.querySelector('.cv-bullets strong')?.textContent).toBe('React')
    expect(text).toContain('Atino Booking Web App')
    expect(text).toContain('Node.js · React · TypeScript')
    expect(text).toContain('Moscow State University (MGSU)')
    expect(text).toContain('Master of Science (M.Sc.) in Technical Economics (Major in Project Management), 2018 – 2020 · Graduated with Honors')
    expect(text).toContain('IBM Professional Data Engineer – In progress')
    expect(container.querySelector('a[href="https://coursera.org/share/3771af72e4ca6be3cd3a10aedbc024ac"]')?.textContent).toBe(
      'Google Data Analytics',
    )
    expect(text).toContain('Russian: Professional Working Proficiency')
    expect(text).not.toMatch(/mongo/i)
    expect(container.querySelectorAll('.cv-entry')).toHaveLength(en.experience.length + en.projects.length)
  })

  it('leaves out empty optional sections and shows optional fields when set', () => {
    const cv: CvModel = {
      ...en,
      projects: [],
      certifications: [],
      languages: [],
      contact: { ...en.contact, location: 'Hanoi, Vietnam', website: 'https://example.com/' },
    }
    const { container } = render(<CvDocument cv={cv} />)
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent)
    expect(headings).toEqual(['Summary', 'Skills', 'Experience', 'Education'])
    expect(container.querySelector('.cv-contact')?.textContent).toContain('Hanoi, Vietnam')
    expect(container.querySelector('a[href="https://example.com/"]')?.textContent).toBe('example.com')
  })

  it('renders the VI YAML in Vietnamese', () => {
    const { container } = render(<CvDocument cv={vi} />)
    expect(container.textContent).toContain('Võ Anh Duy')
    expect(screen.getByRole('heading', { level: 2, name: 'Kinh nghiệm' })).toBeTruthy()
    expect(container.textContent).toContain('Công ty TNHH Thời trang Atino')
  })
})
