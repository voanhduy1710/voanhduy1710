import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { inlineText, toInline } from '@/lib/content/inline'
import { extractSections } from '@/lib/content/markers'
import { toMdast } from '@/lib/content/mdast'
import { parseCertifications } from '@/lib/content/parse/certifications'
import { parseContact } from '@/lib/content/parse/contact'
import { parseEducation } from '@/lib/content/parse/education'
import { parseHeader } from '@/lib/content/parse/header'
import { parseLanguages } from '@/lib/content/parse/languages'
import { parseSkills } from '@/lib/content/parse/skills'
import { parseSummary } from '@/lib/content/parse/summary'
import { parseTechStack } from '@/lib/content/parse/techStack'
import type { Paragraph } from 'mdast'

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8')
}

const en = extractSections(fixture('README.md'), 'README.md')
const vi = extractSections(fixture('READMEVN.md'), 'READMEVN.md')

function paragraphInline(md: string) {
  const p = toMdast(md).children[0] as Paragraph
  return toInline(p.children)
}

describe('inline model', () => {
  it('keeps bold inside a link and code spans', () => {
    expect(paragraphInline('See [**bold** link](https://x.dev) and `code` *em*')).toEqual([
      { kind: 'text', value: 'See ' },
      { kind: 'link', href: 'https://x.dev', children: [{ kind: 'strong', children: [{ kind: 'text', value: 'bold' }] }, { kind: 'text', value: ' link' }] },
      { kind: 'text', value: ' and ' },
      { kind: 'code', value: 'code' },
      { kind: 'text', value: ' ' },
      { kind: 'em', children: [{ kind: 'text', value: 'em' }] },
    ])
  })

  it('flattens to plain text', () => {
    expect(inlineText(paragraphInline('a **b [c](u)** `d`'))).toBe('a b c d')
  })
})

describe('parseHeader', () => {
  it('reads name, title and links', () => {
    expect(parseHeader(en.header, 'README.md')).toMatchObject({ name: 'Vo Anh Duy', title: 'Data Specialist & Technical Developer' })
    expect(parseHeader(vi.header, 'READMEVN.md').name).toBe('Võ Anh Duy')
    const links = parseHeader(en.header, 'README.md').links
    expect(links).toHaveLength(6)
    expect(links[0]).toEqual({ label: 'Website', href: 'https://voanhduy1710.vercel.app' })
    expect(links[4]).toEqual({ label: 'CV_EN (PDF)', href: 'CV_Vo%20Anh%20Duy_EN.pdf' })
    expect(parseHeader(vi.header, 'READMEVN.md').links[5].label).toBe('CV Tiếng Việt (PDF)')
  })

  it('decodes entities in the heading html', () => {
    expect(parseHeader('<h1>A</h1>\n<h3>B &amp; C</h3>\n\n[x](y)', 'f').title).toBe('B & C')
  })

  it('throws naming the section when the name is absent', () => {
    expect(() => parseHeader('[x](y)', 'README.md')).toThrow(/\[README\.md\].*header/)
  })
})

describe('parseSummary', () => {
  it('returns paragraphs without the heading', () => {
    const s = parseSummary(en.summary, 'README.md')
    expect(s).toHaveLength(2)
    expect(inlineText(s[0])).toMatch(/^Experienced Data Specialist/)
    expect(inlineText(parseSummary(vi.summary, 'READMEVN.md')[0])).toMatch(/^Chuyên viên Phân tích/)
  })

  it('throws when there is no paragraph', () => {
    expect(() => parseSummary('## Summary', 'README.md')).toThrow(/\[README\.md\].*summary/)
  })
})

describe('parseTechStack', () => {
  it('reads logos from img tags, URI-decoded', () => {
    const t = parseTechStack(en['tech-stack'], 'README.md')
    expect(t).toHaveLength(20)
    expect(t[0]).toEqual({ name: 'Docker', logo: 'web/public/logos/Docker.png' })
    expect(t[1]).toEqual({ name: 'Google Cloud Run', logo: 'web/public/logos/Google Cloud Run.png' })
    expect(parseTechStack(vi['tech-stack'], 'READMEVN.md')).toEqual(t)
  })

  it('decodes %20 in src', () => {
    expect(parseTechStack('<p><img src="logos/Google%20Cloud%20Run.png" alt="GCR"/></p>', 'f')).toEqual([
      { name: 'GCR', logo: 'logos/Google Cloud Run.png' },
    ])
  })

  it('throws when there are no images', () => {
    expect(() => parseTechStack('<h2>Tech Stack:</h2>', 'README.md')).toThrow(/\[README\.md\].*tech-stack/)
  })
})

describe('parseSkills', () => {
  it('reads categories and splits tools on top-level commas only', () => {
    const s = parseSkills(en.skills, 'README.md')
    expect(s).toHaveLength(4)
    expect(s[0].category).toBe('Full-Stack Development')
    expect(s[0].tools).toContain('TanStack Query / Table')
    expect(s[0].tools).toContain('Supabase (PostgreSQL, Auth)')
    expect(s[1].tools).toContain('Python (Pandas, Polars, DuckDB, Dagster, Selenium, PySpark)')
    expect(s[1].tools[0]).toBe('Python (Pandas, Polars, DuckDB, Dagster, Selenium, PySpark)')
    expect(s[3].tools[0]).toBe('SQL (OLTP: PostgreSQL, MySQL; OLAP: DuckDB, Google BigQuery)')
    expect(s[2].tools).toEqual(['Google Cloud Run', 'Google Cloud Storage (GCS)', 'Docker', 'Git', 'GitHub Actions', 'Vercel', 'Railway'])
    expect(parseSkills(vi.skills, 'READMEVN.md')[0].category).toBe('Phát triển Full-Stack')
  })

  it('throws naming the section when the table is absent', () => {
    expect(() => parseSkills('## Skills\nno table', 'README.md')).toThrow(/\[README\.md\].*skills/)
  })
})

describe('parseLanguages', () => {
  it('reads name and level', () => {
    const l = parseLanguages(en.languages, 'README.md')
    expect(l).toHaveLength(4)
    expect(l[0]).toEqual({ name: 'Vietnamese', level: 'Native' })
    expect(l[3]).toEqual({ name: 'Korean', level: 'Elementary (In Progress)' })
    expect(parseLanguages(vi.languages, 'READMEVN.md')[0]).toEqual({ name: 'Tiếng Việt', level: 'Bản ngữ' })
  })

  it('throws when the list is absent', () => {
    expect(() => parseLanguages('## Languages', 'README.md')).toThrow(/\[README\.md\].*languages/)
  })
})

describe('parseEducation', () => {
  it('reads school, degrees and the italic note', () => {
    const e = parseEducation(en.education, 'README.md')
    expect(e).toHaveLength(1)
    expect(e[0].school).toBe('Moscow State University (MGSU)')
    expect(e[0].degrees).toHaveLength(2)
    expect(e[0].degrees[0].note).toBe('Graduated with Honors')
    expect(inlineText(e[0].degrees[0].text)).toBe(
      'Master of Science (M.Sc.) in Technical Economics (Major in Project Management), 2018 – 2020',
    )
    expect(e[0].degrees[0].text[0].kind).toBe('strong')
    expect(inlineText(e[0].degrees[1].text)).toBe('Bachelor of Science (B.Sc.) in Technical Engineering, 2014 – 2018')
    expect(parseEducation(vi.education, 'READMEVN.md')[0].degrees[1].note).toBe('Tốt nghiệp loại Xuất sắc')
  })

  it('leaves note undefined when there is no italic line', () => {
    const e = parseEducation('**Uni**\n\n- **BSc**, 2010', 'f')
    expect(e[0].degrees[0]).toEqual({ text: [{ kind: 'strong', children: [{ kind: 'text', value: 'BSc' }] }, { kind: 'text', value: ', 2010' }] })
  })

  it('throws when there is no school', () => {
    expect(() => parseEducation('## Education', 'README.md')).toThrow(/\[README\.md\].*education/)
  })
})

describe('parseContact', () => {
  it('reads labels and inline values', () => {
    const c = parseContact(en.contact, 'README.md')
    expect(c).toHaveLength(3)
    expect(c[0]).toEqual({ label: 'Phone number', value: [{ kind: 'text', value: '+84 978 987 889' }] })
    expect(c[1].label).toBe('Email')
    expect(inlineText(c[1].value)).toBe('voanhduy1710@gmail.com')
    expect(c[2]).toEqual({
      label: 'Website',
      value: [{ kind: 'link', href: 'https://voanhduy1710.vercel.app', children: [{ kind: 'text', value: 'voanhduy1710.vercel.app' }] }],
    })
    expect(parseContact(vi.contact, 'READMEVN.md')[0].label).toBe('Số điện thoại')
  })

  it('keeps a colon inside the value', () => {
    expect(parseContact('- **Hours:** 9:00 – 17:00', 'f')[0]).toEqual({ label: 'Hours', value: [{ kind: 'text', value: '9:00 – 17:00' }] })
  })

  it('throws when the list is absent', () => {
    expect(() => parseContact('## Contact', 'README.md')).toThrow(/\[README\.md\].*contact/)
  })
})

describe('parseCertifications', () => {
  it('reads name, link and status', () => {
    const c = parseCertifications(en.certifications, 'README.md')
    expect(c).toHaveLength(8)
    expect(c.map((x) => x.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(c[0]).toEqual({
      no: 1,
      name: 'Google Data Analytics',
      href: 'https://coursera.org/share/3771af72e4ca6be3cd3a10aedbc024ac',
      status: 'Completed',
    })
    expect(c[7]).toEqual({ no: 8, name: 'IBM Professional Data Engineer', status: 'In progress' })
    expect(c[7]).not.toHaveProperty('href')
    expect(parseCertifications(vi.certifications, 'READMEVN.md')[7].status).toBe('Trong tiến trình')
  })

  it('throws when the table is absent', () => {
    expect(() => parseCertifications('## Certifications', 'README.md')).toThrow(/\[README\.md\].*certifications/)
  })

  it('reads the № cell as a number, tolerating spaces; rejects a non-number or a repeated number', () => {
    const table = (...rows: string[]) => ['| № | Certificate | Status |', '|---|---|---|', ...rows].join('\n')
    expect(parseCertifications(table('|  12  | A | Completed |'), 'README.md')[0].no).toBe(12)
    expect(() => parseCertifications(table('| x | A | Completed |'), 'README.md')).toThrow(/row 1.*№.*"x"/)
    expect(() => parseCertifications(table('| 0 | A | Completed |'), 'README.md')).toThrow(/row 1.*№/)
    expect(() => parseCertifications(table('| 1 | A | Completed |', '| 1 | B | Completed |'), 'README.md')).toThrow(
      /row 2.*№ 1.*more than once/,
    )
  })
})
