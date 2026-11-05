import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analysisIcon, skillsOf } from '@/lib/projectReadme/analyses'
import { PageIcon } from '@/components/shell/icons'
import { buildNav } from '@/lib/nav'

describe('analysisIcon (from the skills line)', () => {
  it.each([
    ['Skills Used: Power BI, DAX, Data Modeling, Retail Analytics', 'powerbi'],
    ['Skills Used: SQL, Power BI', 'powerbi'],
    ['Skills Used: Excel, Data Analysis, Power BI, Inventory Tracking', 'powerbi'],
    ['Skills Used: SQL, Data Modeling', 'sql'],
    ['Skills Used: Excel, Pivot Tables, Data Cleaning, Visualization', 'excel'],
    ['Skills Used: JavaScript / Google Apps Script, REST API, Automation', 'appsscript'],
    ['Kỹ năng sử dụng: SQL, Data Modeling', 'sql'],
    ['', 'powerbi'],
  ])('%s -> %s', (line, icon) => expect(analysisIcon(line)).toBe(icon))

  it('splits the skills', () => expect(skillsOf('Skills Used: A, B ,C')).toEqual(['A', 'B', 'C']))
})

describe('icons exist', () => {
  it.each(['sql', 'appsscript', 'excel'] as const)('%s draws something', (icon) => {
    expect(renderToStaticMarkup(<PageIcon icon={icon} />)).toMatch(/<svg[^>]*>.+<\/svg>/)
  })
  it('a nav analysis carries its icon, default powerbi', () => {
    const nav = buildNav('en', [
      { slug: 'w', title: 'W', badges: [], group: 'Works' },
      { slug: 'p', title: 'P', badges: [], group: 'BI', analyses: [{ slug: 'a', title: 'A', icon: 'sql' }, { slug: 'b', title: 'B' }] },
    ])
    expect(nav.analyses.map((a) => a.icon)).toEqual(['sql', 'powerbi'])
  })
})

describe('real README: icon of each analysis', () => {
  const SLUG = 'data-analyst-portfolio'
  const FIXTURES = join(__dirname, '..', 'fixtures', 'portfolio-projects')
  let dir: string
  const previous = process.env.CONTENT_DIR
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'analysis-icons-'))
    process.env.CONTENT_DIR = dir
    vi.resetModules()
    mkdirSync(join(dir, 'project-readmes'), { recursive: true })
    copyFileSync(join(FIXTURES, 'README.md'), join(dir, 'project-readmes', `${SLUG}.md`))
    copyFileSync(join(FIXTURES, 'READMEVN.md'), join(dir, 'project-readmes', `${SLUG}.vi.md`))
    writeFileSync(
      join(dir, 'project-readmes.json'),
      JSON.stringify({ [SLUG]: { repoUrl: 'https://github.com/voanhduy1710/Portfolio-projects', images: [], vi: true } }),
    )
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    if (previous === undefined) delete process.env.CONTENT_DIR
    else process.env.CONTENT_DIR = previous
  })
  it.each(['en', 'vi'] as const)('%s', async (lang) => {
    const { loadProjectAnalyses } = await import('@/lib/projectAnalyses')
    const icons = Object.fromEntries(loadProjectAnalyses(SLUG, lang)!.analyses.map((a) => [a.slug, a.icon]))
    expect(icons).toEqual({
      'atino-sales-dashboard': 'powerbi',
      'excel-adidas-sales': 'excel',
      'uber-trips': 'powerbi',
      'supply-chain-sales': 'powerbi',
      'lazada-sales-report': 'powerbi',
      'sql-interview-questions': 'sql',
      'google-script-larksuite-auto-report': 'appsscript',
    })
  })
})
