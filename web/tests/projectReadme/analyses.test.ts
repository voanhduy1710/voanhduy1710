import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  analysisSlugs,
  fileAnchor,
  linkedFileKind,
  linkedFiles,
  powerBiUrl,
  sectionSummary,
  shiftHeadings,
  slugify,
  splitAnalyses,
} from '@/lib/projectReadme/analyses'
import { renderReadmeTree } from '@/lib/projectReadme/render'
import { readmeSource } from '@/lib/projectReadme/source'
import { analysisLinkTarget } from '@/lib/projectAnalyses'
import { toHtml } from 'hast-util-to-html'

/** The real voanhduy1710/Portfolio-projects READMEs (copied from the content sync). */
const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', 'portfolio-projects', name), 'utf8')
const EN = fixture('README.md')
const VI = fixture('READMEVN.md')
const SRC = readmeSource('https://github.com/voanhduy1710/Portfolio-projects')

describe('splitAnalyses (the real Portfolio-projects README)', () => {
  const en = splitAnalyses(EN)!
  const vi = splitAnalyses(VI)!

  it('finds the 7 numbered analyses under the first overview heading, in both languages', () => {
    expect(en.heading).toBe('Projects Overview')
    expect(vi.heading).toBe('Tổng quan dự án')
    expect(en.sections.map((s) => [s.number, s.title])).toEqual([
      ['1', 'Atino Sales Dashboard'],
      ['2', 'Excel – Adidas Sales'],
      ['3', 'Uber Trips'],
      ['4', 'Supply Chain & Sales'],
      ['5', 'Lazada Sales Report'],
      ['6', 'SQL interview questions'],
      ['7', 'Google Script Larksuite Auto-Report'],
    ])
    expect(vi.sections.map((s) => s.number)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
  })

  it('keeps the intro before and Tools & Programs / Contact after the analyses', () => {
    expect(en.intro.startsWith('# Portfolio Projects')).toBe(true)
    expect(en.rest.startsWith('## Tools & Programs')).toBe(true)
    expect(en.rest).toContain('## ✆ Contact')
    expect(vi.rest.startsWith('## Công cụ & Chương trình')).toBe(true)
    // Each section stops at the next one: no section holds another's heading.
    for (const s of en.sections) expect(s.body).not.toMatch(/^#{1,3} /m)
  })

  it('EN and VI map to the same slugs (from the English titles, matched by number)', () => {
    const slugs = analysisSlugs(en.sections)
    expect([...slugs.values()]).toEqual([
      'atino-sales-dashboard',
      'excel-adidas-sales',
      'uber-trips',
      'supply-chain-sales',
      'lazada-sales-report',
      'sql-interview-questions',
      'google-script-larksuite-auto-report',
    ])
    expect(vi.sections.map((s) => slugs.get(s.number))).toEqual([...slugs.values()])
  })

  it('extracts the dashboard link of Uber Trips, Supply Chain and Lazada only (same URL in EN and VI)', () => {
    const links = en.sections.map((s) => powerBiUrl(s.body))
    expect(links.map((l) => l !== undefined)).toEqual([false, false, true, true, true, false, false])
    expect(links[2]).toMatch(/^https:\/\/app\.powerbi\.com\/view\?r=.*pageName=e26fe47c30d523a8e80b$/)
    // Lazada's "Interactive dashboard can be found [here](...)" is a short link to the Power BI report.
    expect(links[4]).toBe('https://app.powerbi.com/view?r=eyJrIjoiOTk1OThhNGItYmE0OC00Y2ZjLWFjZDgtM2E3ZmU3NjZmOWM3IiwidCI6Ijg5NjQxZWIwLWU1ZmMtNDRlYi05MWRiLTc4ZDI5YmFkMTc3OCIsImMiOjEwfQ%3D%3D')
    expect(vi.sections.map((s) => powerBiUrl(s.body))).toEqual(links)
  })

  it('a dashboard sentence counts only with an https link the page keeps; app.powerbi.com wins', () => {
    expect(powerBiUrl('Interactive dashboard can be found [here](https://bit.ly/x).')).toBe('https://bit.ly/x')
    expect(powerBiUrl('Xem dashboard tương tác [tại đây](https://bit.ly/y).')).toBe('https://bit.ly/y')
    expect(powerBiUrl('Interactive dashboard can be found [here](http://bit.ly/x).')).toBeUndefined()
    expect(powerBiUrl('Interactive dashboard: none. Other [link](https://example.com).')).toBeUndefined()
    expect(powerBiUrl('A [site](https://example.com). Interactive dashboard [here](https://app.powerbi.com/view?r=z)')).toBe(
      'https://app.powerbi.com/view?r=z',
    )
    expect(powerBiUrl('Interactive dashboard [here](javascript:alert(1))')).toBeUndefined()
  })

  it('lists the repo files sections 6 and 7 link to (the Lazada sub-folder README is not one)', () => {
    expect(en.sections.map((s) => linkedFiles(s.body, SRC))).toEqual([
      [],
      [],
      [],
      [],
      [],
      ['6. SQL_questions.md'],
      ['7. Larksuite Auto report Google script.gs'],
    ])
  })

  it('summarises a section by its skills line', () => {
    expect(sectionSummary(en.sections[2].body)).toBe('Skills Used: SQL, Power BI')
  })

  it('is undefined for a README without numbered analyses; headings in code fences do not count', () => {
    expect(splitAnalyses('# X\n\n## Setup\n\n### Install\n')).toBeUndefined()
    const fenced = '## A\n\n```md\n### 1. Not a heading\n```\n\n## B\n\n### 1. Real\n\nbody\n```\n## not a heading\n```\n'
    const s = splitAnalyses(fenced)!
    expect(s.heading).toBe('B')
    expect(s.sections).toHaveLength(1)
    expect(s.sections[0].body).toContain('## not a heading')
    expect(s.rest).toBe('')
  })
})

describe('helpers', () => {
  it('slugify strips accents, punctuation and Vietnamese đ', () => {
    expect(slugify('Excel – Adidas Sales')).toBe('excel-adidas-sales')
    expect(slugify('Phân tích Đơn hàng & Doanh thu')).toBe('phan-tich-don-hang-doanh-thu')
  })

  it('analysisSlugs makes repeated titles unique', () => {
    const s = analysisSlugs([
      { number: '1', title: 'Sales', body: '' },
      { number: '2', title: 'Sales', body: '' },
      { number: '3', title: '!!!', body: '' },
    ])
    expect([...s.values()]).toEqual(['sales', 'sales-2', 'analysis-3'])
  })

  it('shiftHeadings moves headings outside code fences, clamped to 1..6', () => {
    expect(shiftHeadings('#### A\n\n```\n#### code\n```\n# B', -2)).toBe('## A\n\n```\n#### code\n```\n# B')
    expect(shiftHeadings('## Q\n###### Deep', 1)).toBe('### Q\n###### Deep')
  })

  it('linkedFileKind allow-lists markdown and code files, never READMEs or other types', () => {
    expect(linkedFileKind('5. SQL_questions.md')).toBe('markdown')
    expect(linkedFileKind('6. x.gs')).toBe('code')
    expect(linkedFileKind('README.md')).toBeUndefined()
    expect(linkedFileKind('a/READMEVN.md')).toBeUndefined()
    expect(linkedFileKind('data.csv')).toBeUndefined()
    expect(linkedFileKind('.env')).toBeUndefined()
  })
})

describe('relative-link rewriting on the analysis pages', () => {
  const en = splitAnalyses(EN)!
  const files = [{ path: '6. SQL_questions.md', anchor: fileAnchor('6. SQL_questions.md') }]
  const html = (md: string, target = analysisLinkTarget(files)) =>
    toHtml(renderReadmeTree(md, { slug: 'data-analyst-portfolio', source: SRC, images: new Set(), linkTarget: target }))

  it('a link to a file shown in-page becomes its anchor (no GitHub, no new tab)', () => {
    const out = html(en.sections[5].body)
    expect(out).toContain('<a href="#file-6-sql-questions-md">6. SQL_questions.md</a>')
    expect(out).not.toContain('github.com')
  })

  it('any other repo-relative link loses its href; absolute links still open in a new tab', () => {
    const out = html('[folder](3.%20Uber%20Trips) and [pbi](https://app.powerbi.com/view?r=x)')
    expect(out).toContain('<a>folder</a>')
    expect(out).toContain('<a href="https://app.powerbi.com/view?r=x" target="_blank" rel="noopener noreferrer">pbi</a>')
  })

  it('without linkTarget, repo-relative links still go to GitHub (other projects unchanged)', () => {
    const out = toHtml(renderReadmeTree('[f](docs/a.md)', { slug: 'x', source: SRC, images: new Set() }))
    expect(out).toContain('href="https://github.com/voanhduy1710/Portfolio-projects/blob/main/docs/a.md"')
  })

  it('raw HTML in a linked markdown file is sanitised (tables kept, scripts and handlers dropped)', () => {
    const out = html('<table><tr><td onclick="x()">cell</td></tr></table><script>alert(1)</script>')
    expect(out).toContain('<td>cell</td>')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('<script')
  })
})

describe('withoutDashboardParagraph', () => {
  it('drops the paragraph with the dashboard sentence and keeps the rest', async () => {
    const { withoutDashboardParagraph } = await import('@/lib/projectReadme/analyses')
    const md = [
      'Skills Used: SQL, Power BI',
      '',
      'Analyzing Uber trips in June 2024. Interactive dashboard can be found [here](https://app.powerbi.com/view?r=x).',
      '',
      '- A bullet',
      '',
      '```',
      'Interactive dashboard can be found [here](https://example.com) inside code',
      '```',
    ].join('\n')
    const out = withoutDashboardParagraph(md)
    expect(out).not.toContain('Analyzing Uber trips')
    expect(out).toContain('Skills Used: SQL, Power BI')
    expect(out).toContain('- A bullet')
    expect(out).toContain('inside code')
  })

  it('also drops the Vietnamese sentence with a trailing "Full details" link', async () => {
    const { withoutDashboardParagraph } = await import('@/lib/projectReadme/analyses')
    const md = 'Kỹ năng\n\nPhân tích Lazada. Xem dashboard tương tác [tại đây](https://bit.ly/x). Chi tiết đầy đủ: [README](a/README.md).\n\n- Ý'
    expect(withoutDashboardParagraph(md)).toBe('Kỹ năng\n\n- Ý')
  })

  it('leaves a section without the sentence unchanged', async () => {
    const { withoutDashboardParagraph } = await import('@/lib/projectReadme/analyses')
    expect(withoutDashboardParagraph('Skills\n\n- a\n- b')).toBe('Skills\n\n- a\n- b')
  })
})
