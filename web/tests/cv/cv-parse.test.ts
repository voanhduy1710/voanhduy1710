import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse, stringify } from 'yaml'
import { CV_FILES, parseCv, parseCvPair, validateCvPair } from '@/lib/cv'

// The real CV files (web/public/cv/): versioned with the site, so the tests check what is published.
const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const EN = read(CV_FILES.en)
const VI = read(CV_FILES.vi)

/** `base` as plain data, changed by `edit`, back to YAML. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function variant(edit: (d: Record<string, any>) => void, base = EN): string {
  const d = parse(base)
  edit(d)
  return stringify(d)
}

/** The error message of parsing `text` as the EN file. */
function errorOf(text: string): string {
  try {
    parseCv(text, 'en', CV_FILES.en)
  } catch (e) {
    return (e as Error).message
  }
  throw new Error('expected parseCv to throw')
}

describe('parseCv: valid files', () => {
  const en = parseCv(EN, 'en', CV_FILES.en)

  it('reads every section of the EN file', () => {
    expect(en.name).toBe('Vo Anh Duy')
    expect(en.title).toBe('Data Specialist & Technical Developer')
    expect(en.contact).toEqual({
      phone: '+84 978 987 889',
      email: 'voanhduy1710@gmail.com',
      github: 'https://github.com/voanhduy1710',
      linkedin: 'https://www.linkedin.com/in/voanhduy1710',
    })
    expect(en.summary).toHaveLength(2)
    expect(en.skills.map((s) => s.category)).toEqual(['Full-Stack Development', 'Data Engineering & Automation', 'Cloud & DevOps', 'Data Analytics & BI'])
    expect(en.experience.map((e) => e.company)).toEqual(['Atino Fashion Co., Ltd.', 'VWS Joint Stock Company', 'Mosvodokanal'])
    expect(en.experience.map((e) => e.bullets.length)).toEqual([4, 3, 2])
    expect(en.projects).toHaveLength(7)
    expect(en.education[0].degrees[0]).toEqual({
      degree: 'Master of Science (M.Sc.) in Technical Economics',
      detail: 'Major in Project Management',
      period: '2018 – 2020',
      note: 'Graduated with Honors',
    })
    expect(en.certifications).toHaveLength(8)
    expect(en.certifications[7]).toEqual({ name: 'IBM Professional Data Engineer', status: 'In progress' })
    expect(en.languages.map((l) => l.name)).toEqual(['Vietnamese', 'English', 'Russian', 'Korean'])
  })

  it('parses inline markdown in bullets: **bold**, *italic*, [links](https://...)', () => {
    expect(en.experience[0].bullets[3]).toEqual([
      { kind: 'text', value: 'Built daily-refresh ' },
      { kind: 'strong', children: [{ kind: 'text', value: 'Power BI dashboards' }] },
      { kind: 'text', value: ' and star-schema models across ' },
      { kind: 'strong', children: [{ kind: 'text', value: '50+ stores' }] },
      { kind: 'text', value: ', tracking ' },
      { kind: 'strong', children: [{ kind: 'text', value: 'P&L' }] },
      { kind: 'text', value: ', gross margins, and inventory turnover.' },
    ])
    const cv = parseCv(variant((d) => (d.summary = ['See *my* [site](https://example.com).'])), 'en', CV_FILES.en)
    expect(cv.summary[0]).toEqual([
      { kind: 'text', value: 'See ' },
      { kind: 'em', children: [{ kind: 'text', value: 'my' }] },
      { kind: 'text', value: ' ' },
      { kind: 'link', href: 'https://example.com', children: [{ kind: 'text', value: 'site' }] },
      { kind: 'text', value: '.' },
    ])
  })

  it('optional sections and fields may be left out', () => {
    const cv = parseCv(
      variant((d) => {
        delete d.projects
        delete d.certifications
        delete d.languages
        d.contact = { email: 'a@b.co' }
        delete d.experience[0].location
      }),
      'en',
      CV_FILES.en,
    )
    expect(cv.projects).toEqual([])
    expect(cv.certifications).toEqual([])
    expect(cv.languages).toEqual([])
    expect(cv.contact).toEqual({ email: 'a@b.co' })
    expect(cv.experience[0].location).toBeUndefined()
  })

  it('mentions no MongoDB (removed from the stack)', () => {
    expect(EN + VI).not.toMatch(/mongo/i)
  })
})

describe('parseCv: invalid files name the file, the field path and the line', () => {
  it('YAML syntax error', () => {
    expect(errorOf('name: "Vo Anh Duy\ntitle: [x\n')).toMatch(/^\[public\/cv\/cv\.en\.yaml\] invalid YAML:/)
  })

  it('duplicate field', () => {
    expect(errorOf('name: a\nname: b\n')).toMatch(/invalid YAML:[\s\S]*unique/i)
  })

  it('missing required field', () => {
    const msg = errorOf(variant((d) => delete d.experience[1].role))
    expect(msg).toContain('experience[1].role')
    expect(msg).toContain('missing (required)')
    expect(errorOf(variant((d) => delete d.name))).toContain('name: missing (required)')
  })

  it('unknown field (typo)', () => {
    const msg = errorOf(
      variant((d) => {
        d.experience[0].bulets = d.experience[0].bullets
        delete d.experience[0].bullets
      }),
    )
    expect(msg).toContain('unknown field "bulets"')
    expect(msg).toContain('experience[0].bullets')
  })

  it('a number where text is expected suggests quotes, with the line', () => {
    const text = EN.replace('period: "2021 – 2024"', 'period: 2021')
    const line = text.split('\n').findIndex((l) => l.includes('period: 2021')) + 1
    expect(errorOf(text)).toContain(`experience[1].period (line ${line}): expected text, got a number (put it in quotes)`)
  })

  it('wrong kind of value: text instead of a list, list instead of a group', () => {
    const msg = errorOf(variant((d) => (d.skills[2].items = 'Docker, Git')))
    expect(msg).toContain('skills[2].items')
    expect(msg).toContain('expected a list')
    expect(errorOf(variant((d) => (d.contact = ['x'])))).toContain('contact')
  })

  it('empty text and empty lists', () => {
    expect(errorOf(variant((d) => (d.title = '  ')))).toContain('title')
    expect(errorOf(variant((d) => (d.experience[2].bullets = [])))).toContain('experience[2].bullets')
    expect(errorOf(variant((d) => (d.languages = [])))).toContain('remove the field to leave the section out')
  })

  it('bad addresses: web fields need https://, email must be an email, markdown links https:// or mailto:', () => {
    expect(errorOf(variant((d) => (d.contact.github = 'github.com/x')))).toContain('contact.github')
    expect(errorOf(variant((d) => (d.certifications[0].link = 'ftp://x')))).toContain('certifications[0].link')
    expect(errorOf(variant((d) => (d.contact.email = 'nope')))).toContain('"nope" is not an email address')
    expect(errorOf(variant((d) => (d.summary[0] = 'Click [me](javascript:alert(1))')))).toContain('summary[0]')
  })

  it('block markdown (a list or heading) in a bullet is refused', () => {
    expect(errorOf(variant((d) => (d.experience[0].bullets[0] = '- nested')))).toContain('only one line of text is allowed')
    expect(errorOf(variant((d) => (d.summary[1] = '# Heading')))).toContain('summary[1]')
  })

  it('reports every problem at once', () => {
    const msg = errorOf(
      variant((d) => {
        delete d.name
        d.skills[0].category = 5
        delete d.education[0].degrees[1].degree
      }),
    )
    expect(msg).toContain('(3 problems)')
    expect(msg).toContain('name: missing')
    expect(msg).toContain('skills[0].category')
    expect(msg).toContain('education[0].degrees[1].degree')
  })
})

describe('validateCvPair: EN/VI parity', () => {
  const en = parseCv(EN, 'en', CV_FILES.en)
  const vi = parseCv(VI, 'vi', CV_FILES.vi)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pairError = (edit: (d: Record<string, any>) => void): string => {
    const drifted = parseCv(variant(edit, VI), 'vi', CV_FILES.vi)
    try {
      validateCvPair(en, drifted)
    } catch (e) {
      return (e as Error).message
    }
    throw new Error('expected a parity error')
  }

  it('the real files match', () => {
    expect(() => validateCvPair(en, vi)).not.toThrow()
    expect(parseCvPair({ en: EN, vi: VI }).vi.name).toBe('Võ Anh Duy')
  })

  it('detects a missing bullet, experience entry, skill item, degree and section', () => {
    expect(pairError((d) => d.experience[0].bullets.pop())).toContain(
      'experience[0] bullets: public/cv/cv.en.yaml has 4, public/cv/cv.vi.yaml has 3',
    )
    expect(pairError((d) => d.experience.pop())).toContain('experience entries')
    expect(pairError((d) => d.skills[1].items.pop())).toContain('skills[1] items')
    expect(pairError((d) => d.skills.pop())).toContain('skills categories')
    expect(pairError((d) => delete d.languages)).toContain('languages: public/cv/cv.en.yaml has 4, public/cv/cv.vi.yaml has 0')
    expect(pairError((d) => d.certifications.pop())).toContain('certifications')
    expect(pairError((d) => d.education[0].degrees.pop())).toContain('education[0] degrees')
  })

  it('detects untranslated values that differ: contact, tech lists, links', () => {
    expect(pairError((d) => (d.contact.phone = '+84 000'))).toContain('contact.phone')
    expect(pairError((d) => delete d.contact.linkedin)).toContain('contact fields')
    expect(pairError((d) => (d.projects[0].tech = ['React']))).toContain('projects[0] tech')
    expect(pairError((d) => (d.certifications[2].link = 'https://other.example'))).toContain('certifications[2] link')
  })

  it('lists every difference and names both files', () => {
    const msg = pairError((d) => {
      d.experience[1].bullets.pop()
      d.projects.pop()
    })
    expect(msg).toMatch(/^\[public\/cv\/cv\.en\.yaml \+ public\/cv\/cv\.vi\.yaml\] EN\/VI CV differs/)
    expect(msg).toContain('experience[1] bullets')
    expect(msg).toContain('projects: public/cv/cv.en.yaml has 7, public/cv/cv.vi.yaml has 6')
  })
})

describe('loadCv', () => {
  it('reads web/public/cv/ directly (no content sync) and returns each language', async () => {
    const { loadCv } = await import('@/lib/cv')
    expect(loadCv('en').name).toBe('Vo Anh Duy')
    expect(loadCv('vi').name).toBe('Võ Anh Duy')
    expect(loadCv('en')).toBe(loadCv('en'))
  })
})
