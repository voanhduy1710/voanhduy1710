import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi as vitest } from 'vitest'
import { assetUrl, referencedAssets } from '@/lib/content/assets'
import { ContentError } from '@/lib/content/errors'
import { inlineText } from '@/lib/content/inline'
import { parseReadme, validatePair, type SiteContent } from '@/lib/content'

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8')
}

const fixtureEn = fixture('README.md')
const fixtureVi = fixture('READMEVN.md')
const en = parseReadme(fixtureEn, 'en', 'README.md')
const vi = parseReadme(fixtureVi, 'vi', 'READMEVN.md')

const SLUGS = [
  'atino-booking',
  'caro-app',
  'qandastudy-booking',
  'atino-approval-web',
  'atino-approval-api',
  'atino-workspace',
  'data-analyst-portfolio',
]

describe('parseReadme', () => {
  it('assembles every section', () => {
    expect(en.lang).toBe('en')
    expect(vi.lang).toBe('vi')
    expect(en.header.name).toBe('Vo Anh Duy')
    expect(vi.header.name).toBe('Võ Anh Duy')
    expect(en.summary.length).toBeGreaterThan(0)
    expect(en.techStack.length).toBe(20)
    expect(en.skills.length).toBeGreaterThan(0)
    expect(en.experience).toHaveLength(3)
    expect(en.projects.map((p) => p.slug)).toEqual(SLUGS)
    expect(en.languages.length).toBeGreaterThan(0)
    expect(en.education.length).toBeGreaterThan(0)
    expect(en.contact.length).toBeGreaterThan(0)
    expect(en.certifications).toHaveLength(8)
  })

  it('attaches preview images to projects, empty when a project has none', () => {
    const qanda = en.projects.find((p) => p.slug === 'qandastudy-booking')!
    expect(qanda.images.map((i) => i.src)).toEqual([
      'web/public/previews/Other-private-repo-previews/1. QandaStudy-booking-webapp/Preview_0.png',
      'web/public/previews/Other-private-repo-previews/1. QandaStudy-booking-webapp/Preview_2.png',
    ])
    expect(en.projects.find((p) => p.slug === 'data-analyst-portfolio')!.images).toEqual([])
  })

  it('drops the Website link from the header in both languages, keeps the rest', () => {
    expect(en.header.links.map((l) => l.label)).not.toContain('Website')
    expect(vi.header.links.map((l) => l.label)).not.toContain('Trang web')
    for (const c of [en, vi]) {
      expect(c.header.links.some((l) => l.href.includes('voanhduy1710.vercel.app'))).toBe(false)
      expect(c.header.links.map((l) => l.href)).toContain('https://github.com/voanhduy1710')
    }
  })

  it('drops the self-link Website item from contact in both languages, keeps the rest', () => {
    expect(fixtureEn).toContain('- **Website:** [voanhduy1710.vercel.app]')
    for (const c of [en, vi]) {
      expect(c.contact.some((i) => inlineText(i.value).includes('voanhduy1710.vercel.app'))).toBe(false)
      expect(c.contact.some((i) => inlineText(i.value).includes('voanhduy1710@gmail.com'))).toBe(true)
    }
    expect(en.contact.map((i) => i.label)).not.toContain('Website')
    const dev = fixtureEn.replace('- **Website:** [voanhduy1710.vercel.app](https://voanhduy1710.vercel.app)', '- **Website:** [site](https://voanhduy1710.dev)')
    expect(parseReadme(dev, 'en', 'README.md').contact.map((i) => i.label)).not.toContain('Website')
  })

  it('also drops a voanhduy1710.dev Website link', () => {
    const md = fixtureEn.replace('https://voanhduy1710.vercel.app)', 'https://voanhduy1710.dev/)')
    expect(parseReadme(md, 'en', 'README.md').header.links.map((l) => l.label)).not.toContain('Website')
  })

  it('derives cvHref from the header PDF links as served URLs', () => {
    expect(en.cvHref.en).toBe('/content/CV_Vo%20Anh%20Duy_EN.pdf')
    expect(en.cvHref.vi).toBe('/content/CV_Vo%20Anh%20Duy_VN.pdf')
    expect(vi.cvHref).toEqual(en.cvHref)
  })

  it('maps README-relative header links (the CV PDFs) to served URLs, leaves absolute ones alone', () => {
    for (const c of [en, vi]) {
      const cvLinks = c.header.links.filter((l) => /\.pdf$/i.test(l.href))
      expect(cvLinks.map((l) => l.href)).toEqual(['/content/CV_Vo%20Anh%20Duy_EN.pdf', '/content/CV_Vo%20Anh%20Duy_VN.pdf'])
      expect(c.header.links.map((l) => l.href)).toContain('mailto:voanhduy1710@gmail.com')
    }
    const md = fixtureEn.replace('[GitHub](https://github.com/voanhduy1710)', '[Top](#top) | [Root](/x.pdf) | [Rel](docs/a%20b.pdf)')
    const hrefs = parseReadme(md, 'en', 'README.md').header.links.map((l) => l.href)
    expect(hrefs).toEqual(expect.arrayContaining(['#top', '/x.pdf', '/content/docs/a%20b.pdf']))
  })

  it('fails when a header CV link is missing', () => {
    const md = fixtureEn.replace(' | [CV_VN (PDF)](CV_Vo%20Anh%20Duy_VN.pdf)', '')
    expect(() => parseReadme(md, 'en', 'README.md')).toThrow(/\[README\.md\] header: .*_VN\.pdf/)
  })

  it('fails when a preview names a project that is not in projects', () => {
    // only the previews entry (### heading) is renamed; the projects entry (####) keeps caro-app
    const md = fixtureEn.replace(/<!-- project: caro-app -->(\r?\n### \[Caro Web App\])/, '<!-- project: caro-ap -->$1')
    expect(md).not.toBe(fixtureEn)
    expect(() => parseReadme(md, 'en', 'README.md')).toThrow(ContentError)
    expect(() => parseReadme(md, 'en', 'README.md')).toThrow('[README.md] preview for unknown project: caro-ap')
  })
})

describe('validatePair', () => {
  it('parses the site status and the 4 roles in both languages', () => {
    expect(en.header.status).toBe('Open to work')
    expect(en.header.roles).toEqual([
      'Full-Stack Data Specialist',
      'Data Analyst',
      'Internal Web App Developer',
      'BI & Reporting Automation',
    ])
    expect(vi.header.status).toBe('Sẵn sàng nhận việc')
    expect(vi.header.roles).toHaveLength(4)
    expect(vi.header.roles[0]).toBe('Chuyên viên Dữ liệu Full-Stack')
  })

  it('leaves status undefined and roles empty when the site lines are absent', () => {
    const md = fixtureEn.replace(/<!--\s*site\s*:[^>]*-->\r?\n/g, '')
    const header = parseReadme(md, 'en', 'README.md').header
    expect(header.status).toBeUndefined()
    expect(header.roles).toEqual([])
  })

  it('tolerates sloppy spacing and drops empty roles', () => {
    const md = fixtureEn.replace(/<!--\s*site\s*:\s*roles[^>]*-->/, '<!--site:roles=A||  B |-->')
    expect(parseReadme(md, 'en', 'README.md').header.roles).toEqual(['A', 'B'])
  })

  it('fails when only one file has a site status', () => {
    expect(() => validatePair(en, { ...vi, header: { ...vi.header, status: undefined } })).toThrow(
      /header status only in README\.md/,
    )
    expect(() => validatePair({ ...en, header: { ...en.header, status: undefined } }, vi)).toThrow(
      /header status only in READMEVN\.md/,
    )
  })

  it('fails when the role counts differ', () => {
    expect(() => validatePair(en, { ...vi, header: { ...vi.header, roles: vi.header.roles.slice(1) } })).toThrow(
      'header roles: README.md has 4, READMEVN.md has 3',
    )
  })

  it('accepts the fixture pair', () => {
    expect(() => validatePair(en, vi)).not.toThrow()
  })

  it('lists slugs present in only one file', () => {
    expect(() => validatePair(en, { ...vi, projects: vi.projects.slice(1) })).toThrow(/only in README\.md: atino-booking/)
    expect(() => validatePair({ ...en, projects: en.projects.slice(0, -1) }, vi)).toThrow(
      /only in READMEVN\.md: data-analyst-portfolio/,
    )
    expect(() => validatePair(en, { ...vi, projects: vi.projects.slice(1) })).toThrow(/^\[README\.md \+ READMEVN\.md\]/)
  })

  it('lists image paths present in only one file', () => {
    const projects = vi.projects.map((p) =>
      p.slug === 'caro-app' ? { ...p, images: [...p.images, { src: 'web/public/previews/Caro-app/Preview_3.png', alt: '' }] } : p,
    )
    expect(() => validatePair(en, { ...vi, projects })).toThrow(/only in READMEVN\.md: web\/public\/previews\/Caro-app\/Preview_3\.png/)
    const techStack = en.techStack.slice(1)
    expect(() => validatePair({ ...en, techStack }, vi)).toThrow(/only in READMEVN\.md: web\/public\/logos\/Docker\.png/)
  })

  it('compares preview images per project, so an image moved to another project is flagged', () => {
    const moved = 'web/public/previews/Caro-app/Preview_2.png'
    const projects = vi.projects.map((p) => {
      if (p.slug === 'caro-app') return { ...p, images: p.images.filter((i) => i.src !== moved) }
      if (p.slug === 'atino-booking') return { ...p, images: [...p.images, { src: moved, alt: '' }] }
      return p
    })
    const run = () => validatePair(en, { ...vi, projects })
    expect(run).toThrow(`preview images of caro-app only in README.md: ${moved}`)
    expect(run).toThrow(`preview images of atino-booking only in READMEVN.md: ${moved}`)
  })

  it('fails when a fixture copy is missing one certification', () => {
    const md = fixtureVi.replace(/^\| 8 \| IBM Professional Data Engineer .*\r?\n/m, '')
    expect(md).not.toBe(fixtureVi)
    const viMissing = parseReadme(md, 'vi', 'READMEVN.md')
    expect(() => validatePair(en, viMissing)).toThrow('certifications: README.md has 8, READMEVN.md has 7')
  })

  it('fails when the certification numbers differ (same count, a № renumbered)', () => {
    const certifications = vi.certifications.map((c) => (c.no === 8 ? { ...c, no: 9 } : c))
    const run = () => validatePair(en, { ...vi, certifications })
    expect(run).toThrow('certification numbers only in README.md: 8')
    expect(run).toThrow('certification numbers only in READMEVN.md: 9')
  })

  it('compares experience entries and bullets, languages, skills, education and contact counts', () => {
    const experience = vi.experience.map((e, i) => (i === 1 ? { ...e, bullets: e.bullets.slice(1) } : e))
    const education = vi.education.map((s, i) => (i === 0 ? { ...s, degrees: [] } : s))
    const broken: SiteContent = {
      ...vi,
      experience,
      languages: vi.languages.slice(1),
      skills: vi.skills.slice(1),
      education,
      contact: vi.contact.slice(1),
    }
    const run = () => validatePair(en, broken)
    const b = en.experience[1].bullets.length
    expect(run).toThrow(`experience #2 bullets: README.md has ${b}, READMEVN.md has ${b - 1}`)
    expect(run).toThrow(`languages: README.md has ${en.languages.length}, READMEVN.md has ${en.languages.length - 1}`)
    expect(run).toThrow(`skills rows: README.md has ${en.skills.length}`)
    expect(run).toThrow(`education school #1 degrees: README.md has ${en.education[0].degrees.length}, READMEVN.md has 0`)
    expect(run).toThrow(`contact items: README.md has ${en.contact.length}`)
    expect(() => validatePair(en, { ...vi, experience: vi.experience.slice(0, 2) })).toThrow(
      /experience entries: README\.md has 3, READMEVN\.md has 2[\s\S]*experience #3 bullets: README\.md has \d+, READMEVN\.md has 0/,
    )
  })

  it('reports every difference in one error', () => {
    const broken: SiteContent = { ...vi, projects: vi.projects.slice(1) }
    try {
      validatePair(en, broken)
      expect.unreachable()
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).toContain('atino-booking')
      expect(msg).toContain('web/public/previews/Atino-booking-webapp/Preview_1.png')
    }
  })
})

describe('referencedAssets', () => {
  const assets = referencedAssets(fixtureEn)

  it('lists README-relative images and PDFs, URI-decoded', () => {
    expect(assets).toContain('CV_Vo Anh Duy_EN.pdf')
    expect(assets).toContain('CV_Vo Anh Duy_VN.pdf')
    expect(assets).toContain('web/public/logos/Google Cloud Run.png')
    expect(assets).toContain('web/public/previews/Other-private-repo-previews/1. QandaStudy-booking-webapp/Preview_0.png')
  })

  it('excludes http(s) and mailto links and dedupes', () => {
    expect(assets.some((a) => a.startsWith('http'))).toBe(false)
    expect(assets.some((a) => a.startsWith('mailto:'))).toBe(false)
    expect(new Set(assets).size).toBe(assets.length)
    // 20 logos + 10 preview screenshots + 2 CVs (MongoDB logo removed)
    expect(assets).toHaveLength(32)
  })

  it('treats encoded and decoded spellings of a path as one asset', () => {
    const md = '<img src="logos/Google Cloud Run.png"/>\n<img src="logos/Google%20Cloud%20Run.png"/>\n'
    expect(referencedAssets(md)).toEqual(['logos/Google Cloud Run.png'])
  })

  it('finds markdown images and html links too', () => {
    const md = '![shot](shots/a%20b.png) [doc](docs/x.pdf) <a href="files/y.pdf">y</a> [x](https://e.com/z.pdf)\n'
    expect(referencedAssets(md)).toEqual(['shots/a b.png', 'docs/x.pdf', 'files/y.pdf'])
  })

  it('vi fixture references the same assets', () => {
    expect(new Set(referencedAssets(fixtureVi))).toEqual(new Set(assets))
  })
})

describe('assetUrl', () => {
  it('serves web/public/ paths from the site root with spaces encoded', () => {
    expect(assetUrl('web/public/logos/Docker.png')).toBe('/logos/Docker.png')
    expect(assetUrl('web/public/logos/Google Cloud Run.png')).toBe('/logos/Google%20Cloud%20Run.png')
    expect(assetUrl('web/public/previews/Other-private-repo-previews/1. QandaStudy-booking-webapp/Preview_0.png')).toBe(
      '/previews/Other-private-repo-previews/1.%20QandaStudy-booking-webapp/Preview_0.png',
    )
  })

  it('serves other README paths (the CV PDFs) under /content with spaces encoded', () => {
    expect(assetUrl('CV_Vo Anh Duy_EN.pdf')).toBe('/content/CV_Vo%20Anh%20Duy_EN.pdf')
    expect(assetUrl('logos/Google Cloud Run.png')).toBe('/content/logos/Google%20Cloud%20Run.png')
  })
})

describe('loadContent', () => {
  const cwd = process.cwd()
  let dir: string | undefined

  afterEach(() => {
    process.chdir(cwd)
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = undefined
    vitest.resetModules()
  })

  function stage(enMd: string, viMd: string): void {
    dir = mkdtempSync(join(tmpdir(), 'content-'))
    mkdirSync(join(dir, 'content'))
    writeFileSync(join(dir, 'content', 'README.md'), enMd)
    writeFileSync(join(dir, 'content', 'READMEVN.md'), viMd)
    process.chdir(dir)
  }

  it('reads content/ relative to cwd, returns the requested language and memoises', async () => {
    stage(fixtureEn, fixtureVi)
    const { loadContent } = await import('@/lib/content')
    const a = loadContent('en')
    expect(a.lang).toBe('en')
    expect(loadContent('vi').header.name).toBe('Võ Anh Duy')
    rmSync(join(dir!, 'content'), { recursive: true })
    expect(loadContent('en')).toBe(a)
  })

  it('fails when the pair drifts', async () => {
    // caro-app removed from both projects and previews in the vi file only
    const viNoCaro = fixtureVi.replace(/<!-- project: caro-app -->[\s\S]*?(?=<!-- project: qandastudy-booking -->)/g, '')
    expect(viNoCaro).not.toContain('caro-app')
    stage(fixtureEn, viNoCaro)
    const { loadContent } = await import('@/lib/content')
    expect(() => loadContent('en')).toThrow(/only in README\.md: caro-app/)
  })

  it('does not read files at import time', async () => {
    dir = mkdtempSync(join(tmpdir(), 'content-'))
    process.chdir(dir)
    await expect(import('@/lib/content')).resolves.toBeDefined()
  })
})
