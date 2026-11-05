import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compareCvHtml, cvShape, normalizeHref } from '@/lib/cv/htmlDrift'

const cv = (body: string) => `<!DOCTYPE html><html><head><title>x</title></head><body><main class="cv">${body}</main></body></html>`

const EN = cv(`
  <header><a href="mailto:a@b.c">Email</a><a href="https://voanhduy1710.vercel.app">Website</a></header>
  <section class="experience">
    <article class="job"><h3>A</h3><ul><li>one</li><li>two</li></ul></article>
    <article class="job"><h3>B</h3><ul><li>one</li></ul></article>
  </section>
  <section class="projects"><ul><li><a href="https://voanhduy1710.vercel.app/en/projects/p1">P1</a></li></ul></section>
  <section class="skills"><dl><dt>S1</dt><dd>x</dd><dt>S2</dt><dd>y</dd></dl></section>
  <div class="cols">
    <section class="education"><div class="degree">D1</div></section>
    <section class="languages"><ul><li>L1</li><li>L2</li></ul></section>
    <section class="certifications"><ul><li><a href="https://c/1">C1</a></li></ul></section>
  </div>`)

describe('cvShape', () => {
  it('counts the structure of a CV file', () => {
    expect(cvShape(EN)).toEqual({
      sections: ['experience', 'projects', 'skills', 'education', 'languages', 'certifications'],
      jobs: [2, 1],
      projects: 1,
      skills: 2,
      certifications: 1,
      degrees: 1,
      languages: 2,
      hrefs: [
        'https://c/1',
        'https://voanhduy1710.vercel.app',
        'https://voanhduy1710.vercel.app/{lang}/projects/p1',
        'mailto:a@b.c',
      ],
    })
  })
})

describe('normalizeHref', () => {
  it('ignores only the language of website page links', () => {
    expect(normalizeHref('https://voanhduy1710.vercel.app/vi/projects/x')).toBe(normalizeHref('https://voanhduy1710.vercel.app/en/projects/x'))
    expect(normalizeHref('https://voanhduy1710.vercel.app/vi')).toBe('https://voanhduy1710.vercel.app/{lang}')
    expect(normalizeHref('https://voanhduy1710.vercel.app/video')).toBe('https://voanhduy1710.vercel.app/video')
    expect(normalizeHref('https://example.com/en/x')).toBe('https://example.com/en/x')
  })
})

describe('compareCvHtml', () => {
  it('reports nothing when only the words (and /en/ vs /vi/) differ', () => {
    const vn = EN.replace(/>one</g, '>một<').replace('/en/projects', '/vi/projects')
    expect(compareCvHtml(EN, vn)).toEqual([])
  })

  it('reports a missing bullet, job, skills row and language', () => {
    const vn = EN.replace('<li>one</li><li>two</li>', '<li>one</li>')
      .replace('<dt>S2</dt><dd>y</dd>', '')
      .replace('<li>L2</li>', '')
    expect(compareCvHtml(EN, vn)).toEqual([
      'bullets of job 1: EN has 2, VN has 1',
      'skills rows: EN has 2, VN has 1',
      'languages: EN has 2, VN has 1',
    ])
    const noJob = EN.replace('<article class="job"><h3>B</h3><ul><li>one</li></ul></article>', '')
    expect(compareCvHtml(EN, noJob)).toEqual(['jobs: EN has 2, VN has 1'])
  })

  it('reports extra sections, projects, degrees and certifications', () => {
    const vn = EN.replace('<section class="skills">', '<section class="summary"><p>x</p></section><section class="skills">')
      .replace('<div class="degree">D1</div>', '<div class="degree">D1</div><div class="degree">D2</div>')
      .replace('<li><a href="https://c/1">C1</a></li>', '<li><a href="https://c/1">C1</a></li><li>C2</li>')
      .replace('P1</a></li>', 'P1</a></li><li>P2</li>')
    expect(compareCvHtml(EN, vn)).toEqual([
      'sections: EN has 6, VN has 7',
      'projects: EN has 1, VN has 2',
      'certifications: EN has 1, VN has 2',
      'degrees: EN has 1, VN has 2',
    ])
  })

  it('reports links that are not in both files', () => {
    const vn = EN.replace('https://c/1', 'https://c/2')
    expect(compareCvHtml(EN, vn)).toEqual(['link only in EN: https://c/1', 'link only in VN: https://c/2'])
  })

  it('finds no drift between the real CV_EN.html and CV_VN.html', () => {
    const dir = resolve(__dirname, '..', '..', 'public', 'cv')
    const en = readFileSync(resolve(dir, 'CV_EN.html'), 'utf8')
    const vn = readFileSync(resolve(dir, 'CV_VN.html'), 'utf8')
    expect(compareCvHtml(en, vn)).toEqual([])
    expect(cvShape(en).jobs).toEqual([4, 2, 2])
  })
})
