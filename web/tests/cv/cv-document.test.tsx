// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CvDocument } from '@/components/cv/CvDocument'
import { parseReadme } from '@/lib/content'

// jsdom gives `import.meta.url` an http: scheme, so fixtures are found from the package root (vitest's cwd).
function fixture(name: string): string {
  return readFileSync(join(process.cwd(), 'tests', 'fixtures', name), 'utf8')
}

const en = parseReadme(fixture('README.md'), 'en', 'README.md')
const vi = parseReadme(fixture('READMEVN.md'), 'vi', 'READMEVN.md')

afterEach(cleanup)

describe('CvDocument', () => {
  it('renders the name, experience and contact line from the EN README', () => {
    const { container } = render(<CvDocument content={en} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Vo Anh Duy')
    expect(screen.getByText('Data Specialist & Technical Developer')).toBeTruthy()
    expect(screen.getByText('Atino Fashion Co., Ltd.')).toBeTruthy()
    expect(container.textContent).toContain('+84 978 987 889')
    expect(container.textContent).toContain('github.com/voanhduy1710')
  })

  it('has no images and no link to the website itself', () => {
    const { container } = render(<CvDocument content={en} />)
    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(container.textContent).not.toContain('voanhduy1710.vercel.app')
  })

  it('renders every section: skills, projects with badge labels, education, certifications, languages', () => {
    const { container } = render(<CvDocument content={en} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Full-Stack Development')
    expect(text).toContain('TypeScript, JavaScript, React')
    expect(text).toContain('Atino Booking Web App')
    expect(text).toContain('Node.js · React · TypeScript')
    expect(text).toContain('Moscow State University (MGSU)')
    expect(text).toContain('IBM Professional Data Engineer – In progress')
    expect(text).toContain('Russian: Professional Working Proficiency')
    expect(container.querySelectorAll('.cv-entry')).toHaveLength(en.experience.length + en.projects.length)
  })

  it('builds each project tech line from badge alt text: deduped, without "Tests"', () => {
    const { container } = render(<CvDocument content={en} />)
    const tech = (slug: string) => container.querySelector(`[data-project="${slug}"] .cv-tech`)?.textContent ?? ''
    const booking = tech('atino-booking')
    expect(booking).toContain('Supabase')
    expect(booking).not.toContain('Database')
    expect(booking).not.toContain('Tests')
    const parts = booking.split(' · ')
    expect(new Set(parts.map((p) => p.toLowerCase())).size).toBe(parts.length)
  })

  it('drops a trailing colon from the project line', () => {
    const { container } = render(<CvDocument content={en} />)
    const line = container.querySelector('[data-project="data-analyst-portfolio"] .cv-line')?.textContent ?? ''
    expect(line).toBe('A curated collection of business analytics, modeling, and automation implementations')
  })

  it('renders the VI README in Vietnamese', () => {
    const { container } = render(<CvDocument content={vi} />)
    expect(container.textContent).toContain('Võ Anh Duy')
    expect(screen.getByRole('heading', { level: 2, name: 'Kinh nghiệm' })).toBeTruthy()
  })
})
