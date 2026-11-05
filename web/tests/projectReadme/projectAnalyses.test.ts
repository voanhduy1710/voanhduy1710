import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analysisRoutes } from '../../scripts/check-links'

const FIXTURES = join(__dirname, '..', 'fixtures', 'portfolio-projects')
const SLUG = 'data-analyst-portfolio'
let dir: string
const previous = process.env.CONTENT_DIR

/** A synced content folder holding the real Portfolio-projects READMEs, its manifest and the two linked files. */
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'analyses-'))
  process.env.CONTENT_DIR = dir
  vi.resetModules()
  mkdirSync(join(dir, 'project-readmes', SLUG), { recursive: true })
  copyFileSync(join(FIXTURES, 'README.md'), join(dir, 'project-readmes', `${SLUG}.md`))
  copyFileSync(join(FIXTURES, 'READMEVN.md'), join(dir, 'project-readmes', `${SLUG}.vi.md`))
  writeFileSync(join(dir, 'project-readmes', SLUG, '6. SQL_questions.md'), '## Q1\n\n<table><tr><td>t</td></tr></table>\n')
  writeFileSync(join(dir, 'project-readmes', SLUG, '7. Larksuite Auto report Google script.gs'), 'function run() {}\n')
  writeFileSync(
    join(dir, 'project-readmes.json'),
    JSON.stringify({
      [SLUG]: {
        repoUrl: 'https://github.com/voanhduy1710/Portfolio-projects',
        images: [
          '3. Uber Trips/3. Uber Trips Dashboard.png.webp',
          '5. Lazada Sales Report/5. Lazada Sales Dashboard.png.webp',
          '5. Lazada Sales Report/Data preview.png.webp',
          '6. SQL_preview.png.webp',
        ],
        vi: true,
        files: ['6. SQL_questions.md', '7. Larksuite Auto report Google script.gs'],
      },
    }),
  )
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  if (previous === undefined) delete process.env.CONTENT_DIR
  else process.env.CONTENT_DIR = previous
})

describe('loadProjectAnalyses', () => {
  it('EN and VI: the same 7 slugs, VI titles/sub-headings from READMEVN.md, sub-sections moved up to ##', async () => {
    const { loadProjectAnalyses } = await import('@/lib/projectAnalyses')
    const en = loadProjectAnalyses(SLUG, 'en')!
    const vi = loadProjectAnalyses(SLUG, 'vi')!
    expect(en.analyses).toHaveLength(7)
    expect(vi.analyses.map((a) => a.slug)).toEqual(en.analyses.map((a) => a.slug))
    const uber = en.analyses[2]
    expect(uber.body).toMatch(/^## Key Metrics & Dimensions$/m)
    expect(vi.analyses[2].body).toMatch(/^## Chỉ số & Chiều phân tích chính$/m)
    expect(vi.heading).toBe('Tổng quan dự án')
    expect(uber.powerBiUrl).toMatch(/^https:\/\/app\.powerbi\.com\//)
    expect(en.analyses[0].powerBiUrl).toBeUndefined()
    // First image the section shows, among the synced ones.
    expect(uber.cover).toBe('/content/project-readmes/data-analyst-portfolio/3.%20Uber%20Trips/3.%20Uber%20Trips%20Dashboard.png.webp')
  })

  it('Lazada Sales Report: its own page in EN and VI, Power BI icon, dashboard short link, dashboard image as cover', async () => {
    const { loadProjectAnalyses } = await import('@/lib/projectAnalyses')
    for (const lang of ['en', 'vi'] as const) {
      const lazada = loadProjectAnalyses(SLUG, lang)!.analyses[4]
      expect([lazada.number, lazada.slug, lazada.title, lazada.icon]).toEqual(['5', 'lazada-sales-report', 'Lazada Sales Report', 'powerbi'])
      expect(lazada.powerBiUrl).toBe('https://bit.ly/Lazada_sales_reports')
      expect(lazada.cover).toBe(
        '/content/project-readmes/data-analyst-portfolio/5.%20Lazada%20Sales%20Report/5.%20Lazada%20Sales%20Dashboard.png.webp',
      )
      expect(lazada.files).toEqual([])
    }
    const vi = loadProjectAnalyses(SLUG, 'vi')!.analyses[4]
    expect(vi.summary).toBe('Kỹ năng sử dụng: Excel, Power BI, DAX, Data Modeling, E-commerce Analytics')
    expect(vi.body).toMatch(/^## Chỉ số & Chiều phân tích chính$/m)
  })

  it('attaches the synced linked files to sections 6 (markdown) and 7 (code)', async () => {
    const { loadProjectAnalyses } = await import('@/lib/projectAnalyses')
    const a = loadProjectAnalyses(SLUG, 'vi')!.analyses
    expect(a[5].files.map((f) => [f.name, f.kind, f.anchor])).toEqual([['6. SQL_questions.md', 'markdown', 'file-6-sql-questions-md']])
    expect(a[6].files.map((f) => [f.name, f.kind, f.text])).toEqual([['7. Larksuite Auto report Google script.gs', 'code', 'function run() {}\n']])
    expect(a.slice(0, 5).every((x) => x.files.length === 0)).toBe(true)
  })

  it('reads only manifest-listed files', async () => {
    const { loadProjectReadmeFile } = await import('@/lib/projectReadmeManifest')
    expect(loadProjectReadmeFile(SLUG, '6. SQL_questions.md')).toContain('## Q1')
    // The pre-rename name is not in the manifest any more.
    expect(loadProjectReadmeFile(SLUG, '5. SQL_questions.md')).toBeUndefined()
    expect(loadProjectReadmeFile(SLUG, '../project-readmes.json')).toBeUndefined()
    expect(loadProjectReadmeFile('nope', '6. SQL_questions.md')).toBeUndefined()
  })
})

describe('check-links analysisRoutes', () => {
  it('requires every analysis page of the analytics project, in both languages', () => {
    const profile = readFileSync(join(__dirname, '..', 'fixtures', 'README.md'), 'utf8')
    const md = readFileSync(join(FIXTURES, 'README.md'), 'utf8')
    const routes = analysisRoutes(profile, 'README.md', (slug) => (slug === SLUG ? md : undefined))
    expect(routes).toHaveLength(14)
    expect(routes).toContain('/en/projects/data-analyst-portfolio/uber-trips')
    expect(routes).toContain('/en/projects/data-analyst-portfolio/lazada-sales-report')
    expect(routes).toContain('/vi/projects/data-analyst-portfolio/lazada-sales-report')
    expect(routes).toContain('/vi/projects/data-analyst-portfolio/google-script-larksuite-auto-report')
    expect(analysisRoutes(profile, 'README.md', () => undefined)).toEqual([])
  })
})
