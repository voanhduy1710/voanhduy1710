import { describe, expect, it } from 'vitest'
import type { Inline } from '@/lib/content/types'
import { buildNav, bulletTitle, compareFileNames, cvFileName, orderRootFiles, findNavPage, isFolderOpen, navPages, projectIcon, type NavProject } from '@/lib/nav'

const FULL_STACK = 'Full-Stack Applications & Production Systems'
const ANALYTICS = 'Data Analytics & Business Intelligence'

const bullet = (title: string, rest: string): Inline[] => [
  { kind: 'strong', children: [{ kind: 'text', value: `${title}:` }] },
  { kind: 'text', value: ` ${rest}` },
]

const projects: NavProject[] = [
  { slug: 'caro-app', title: 'Caro Web App', group: FULL_STACK, badges: [{ label: 'Node.js' }, { label: 'React' }] },
  { slug: 'atino-booking', title: 'Atino Booking Web App', group: FULL_STACK, badges: [{ label: 'Database', alt: 'Supabase' }] },
  {
    slug: 'data-analyst-portfolio',
    title: 'Data Analyst Portfolio Projects',
    group: ANALYTICS,
    badges: [{ label: 'Power_BI' }],
    bullets: [bullet('Atino Multi-Store Retail Model', 'Star schema.'), bullet('Uber Trip Analytics', 'SQL.'), [{ kind: 'text', value: 'No bold lead' }]],
  },
]

const certifications = [
  { no: 1, name: 'Google Data Analytics', href: 'https://coursera.org/x', status: 'Completed' },
  { no: 8, name: 'IBM Professional Data Engineer', status: 'In progress' },
]

describe('buildNav', () => {
  it('lists the public/ rows as sections of the home page, in page order, without education', () => {
    const nav = buildNav('en', projects)
    expect(nav.sections.map((s) => [s.id, s.label, s.href])).toEqual([
      ['about', 'About Me', '/en#about'],
      ['experience', 'Work Experience', '/en#experience'],
      ['skills', 'Skills', '/en#skills'],
      ['projects', 'Projects', '/en#projects'],
      ['contact', 'Contact Me', '/en#contact'],
    ])
    // No about_me.ts any more: the home tab is "About Me" and its file is the page component.
    expect(nav.home).toEqual({ id: 'home', label: 'About Me', href: '/en', icon: 'star', fileName: 'page.tsx' })
    expect(JSON.stringify(nav)).not.toContain('about_me')
    expect(nav.cv.href).toBe('/en/cv')
    expect(nav.readme.href).toBe('https://github.com/voanhduy1710')
  })

  it('lists one project page per slug, labelled with its title, in the given order', () => {
    expect(buildNav('en', projects).projects.map((p) => [p.label, p.href, p.icon])).toEqual([
      ['Caro Web App', '/en/projects/caro-app', 'react'],
      ['Atino Booking Web App', '/en/projects/atino-booking', 'file'],
      ['Data Analyst Portfolio Projects', '/en/projects/data-analyst-portfolio', 'powerbi'],
    ])
  })

  it('puts the first README group in My works and the analytics group in BI projects', () => {
    const nav = buildNav('en', projects)
    expect(nav.works.map((p) => p.id)).toEqual(['project:caro-app', 'project:atino-booking'])
    // A lone analytics project: one row per bold-titled bullet, all opening that project's page.
    expect(nav.bi.map((r) => [r.label, r.page.href])).toEqual([
      ['Atino Multi-Store Retail Model', '/en/projects/data-analyst-portfolio'],
      ['Uber Trip Analytics', '/en/projects/data-analyst-portfolio'],
    ])
    expect(new Set(nav.bi.map((r) => r.key)).size).toBe(2)
  })

  it('tells the groups apart by order, so translated group names work the same', () => {
    const vi = projects.map((p) => ({ ...p, group: p.group === FULL_STACK ? 'Ứng dụng Full-Stack' : 'Phân tích Dữ liệu' }))
    const nav = buildNav('vi', vi)
    expect(nav.works).toHaveLength(2)
    expect(nav.bi).toHaveLength(2)
  })

  it('lists the projects themselves when the analytics group has more than one, or no titled bullets', () => {
    const two = [...projects, { slug: 'sales-dashboard', title: 'Sales Dashboard', group: ANALYTICS, badges: [] }]
    expect(buildNav('en', two).bi.map((r) => r.label)).toEqual(['Data Analyst Portfolio Projects', 'Sales Dashboard'])
    const untitled = projects.map((p) => ({ ...p, bullets: [] }))
    expect(buildNav('en', untitled).bi.map((r) => r.label)).toEqual(['Data Analyst Portfolio Projects'])
  })

  it('a single group means everything is in My works and BI projects is empty', () => {
    const nav = buildNav('en', projects.slice(0, 2))
    expect(nav.works).toHaveLength(2)
    expect(nav.bi).toEqual([])
  })

  it('passes the certifications through, link or not; without a synced PDF there is no page', () => {
    expect(buildNav('en', projects, certifications).certifications).toEqual(certifications)
    expect(buildNav('en', projects, certifications, new Set([2])).certifications).toEqual(certifications)
  })

  it('gives a certification with a synced PDF a PDF page tab at /{lang}/certifications/<no>', () => {
    const nav = buildNav('vi', projects, certifications, new Set([1]))
    expect(nav.certifications[0].page).toEqual({
      id: 'cert:1',
      label: 'Google Data Analytics',
      href: '/vi/certifications/1',
      icon: 'pdf',
      fileName: 'Google Data Analytics.pdf',
    })
    expect(nav.certifications[1].page).toBeUndefined()
    expect(navPages(nav).map((p) => p.id)).toContain('cert:1')
    expect(findNavPage(nav, '/vi/certifications/1/')?.id).toBe('cert:1')
    expect(findNavPage(nav, '/vi/certifications/8')).toBeUndefined()
  })

  it('lists the five allow-listed config files as pages under /{lang}/files/', () => {
    expect(buildNav('vi', projects).files.map((f) => [f.id, f.label, f.href, f.icon])).toEqual([
      ['file:gitignore', '.gitignore', '/vi/files/gitignore', 'git'],
      ['file:vercelignore', '.vercelignore', '/vi/files/vercelignore', 'vercel'],
      ['file:next.config.ts', 'next.config.ts', '/vi/files/next.config.ts', 'nextjs'],
      ['file:package.json', 'package.json', '/vi/files/package.json', 'npm'],
      ['file:tsconfig.json', 'tsconfig.json', '/vi/files/tsconfig.json', 'tsconfig'],
    ])
  })

  it('uses Vietnamese labels and /vi hrefs for vi, with the same language-neutral ids', () => {
    const en = navPages(buildNav('en', projects))
    const vi = navPages(buildNav('vi', projects))
    // One home tab (shared by its sections), 3 projects, the CV, 5 config files.
    expect(vi).toHaveLength(10)
    for (const f of vi) expect(f.href.startsWith('/vi')).toBe(true)
    expect(vi.map((f) => f.id)).toEqual(en.map((f) => f.id))
    expect(vi[0].label).toBe('Giới thiệu')
  })

  it('gives every page a unique id', () => {
    const ids = navPages(buildNav('en', projects)).map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('finds the page of a pathname, ignoring a trailing slash', () => {
    const nav = buildNav('en', projects)
    expect(findNavPage(nav, '/en')?.id).toBe('home')
    expect(findNavPage(nav, '/en/')?.id).toBe('home')
    expect(findNavPage(nav, '/en/skills')).toBeUndefined()
    expect(findNavPage(nav, '/en/projects/caro-app/')?.id).toBe('project:caro-app')
    expect(findNavPage(nav, '/en/files/package.json')?.id).toBe('file:package.json')
    expect(findNavPage(nav, '/en/files/.env')).toBeUndefined()
    expect(findNavPage(nav, '/en/nope')).toBeUndefined()
  })
})

describe('bulletTitle', () => {
  it('takes the bold lead without its colon', () => {
    expect(bulletTitle(bullet('Supply Chain & Inventory Management', 'x'))).toBe('Supply Chain & Inventory Management')
    expect(bulletTitle([{ kind: 'strong', children: [{ kind: 'text', value: 'Title' }] }, { kind: 'text', value: ': rest' }])).toBe('Title')
  })

  it('is undefined without a bold lead', () => {
    expect(bulletTitle([{ kind: 'text', value: 'Plain ' }, { kind: 'strong', children: [{ kind: 'text', value: 'late' }] }])).toBeUndefined()
    expect(bulletTitle([])).toBeUndefined()
  })
})

describe('CV row', () => {
  it('is named after the README CV link of the page language and still opens /{lang}/cv', () => {
    const en = buildNav('en', projects, [], new Set(), '/content/CV_Vo%20Anh%20Duy_EN.pdf').cv
    expect(en).toEqual({ id: 'cv', label: 'CV_Vo Anh Duy_EN.pdf', href: '/en/cv', icon: 'pdf', fileName: 'CV_Vo Anh Duy_EN.pdf' })
    const vi = buildNav('vi', projects, [], new Set(), '/content/CV_Vo%20Anh%20Duy_VN.pdf').cv
    expect([vi.label, vi.fileName, vi.href]).toEqual(['CV_Vo Anh Duy_VN.pdf', 'CV_Vo Anh Duy_VN.pdf', '/vi/cv'])
  })

  it('cvFileName decodes the last path segment; cv.pdf when there is no link', () => {
    expect(cvFileName('/content/CV_Vo%20Anh%20Duy_EN.pdf?x=1#p')).toBe('CV_Vo Anh Duy_EN.pdf')
    expect(cvFileName('/content/bad%E0.pdf')).toBe('bad%E0.pdf')
    expect(cvFileName(undefined)).toBe('cv.pdf')
    expect(buildNav('en', projects).cv.label).toBe('cv.pdf')
  })
})

describe('orderRootFiles', () => {
  it('puts the CV first, README.md second, then the config files in VS Code order', () => {
    const files = ['tsconfig.json', 'package.json', '.vercelignore', 'next.config.ts', '.gitignore'].map((name) => ({ name, item: name }))
    expect(orderRootFiles('CV_Vo Anh Duy_EN.pdf', 'README.md', files)).toEqual([
      'CV_Vo Anh Duy_EN.pdf',
      'README.md',
      '.gitignore',
      '.vercelignore',
      'next.config.ts',
      'package.json',
      'tsconfig.json',
    ])
  })
})

describe('compareFileNames', () => {
  it('sorts like the VS Code explorer: dotfiles first, then by name ignoring case', () => {
    const names = ['tsconfig.json', 'README.md', 'package.json', 'cv.pdf', '.vercelignore', 'next.config.ts', '.gitignore']
    expect(names.sort(compareFileNames)).toEqual([
      '.gitignore',
      '.vercelignore',
      'cv.pdf',
      'next.config.ts',
      'package.json',
      'README.md',
      'tsconfig.json',
    ])
  })
})

describe('projectIcon', () => {
  it('prefers the most specific framework badge', () => {
    expect(projectIcon([{ label: 'React' }, { label: 'NestJS' }])).toBe('nestjs')
    expect(projectIcon([{ label: 'Python' }, { label: 'FastAPI' }])).toBe('fastapi')
    expect(projectIcon([{ label: 'Power_BI' }, { label: 'Python' }])).toBe('powerbi')
    expect(projectIcon([{ label: 'Node.js' }, { label: 'React' }, { label: 'TypeScript' }])).toBe('react')
    expect(projectIcon([{ label: 'TypeScript' }])).toBe('typescript')
    expect(projectIcon([{ label: 'Python' }, { label: 'Dagster' }])).toBe('python')
  })

  it('reads the alt text too, and falls back to a file icon', () => {
    expect(projectIcon([{ label: 'Framework', alt: 'React' }])).toBe('react')
    expect(projectIcon([{ label: 'Excel' }])).toBe('file')
    expect(projectIcon([])).toBe('file')
  })
})

describe('isFolderOpen', () => {
  it('starts src and My works open, BI projects and Certifications collapsed', () => {
    expect(isFolderOpen('public', {})).toBe(true)
    expect(isFolderOpen('src', {})).toBe(true)
    expect(isFolderOpen('works', {})).toBe(true)
    expect(isFolderOpen('bi', {})).toBe(false)
    expect(isFolderOpen('certifications', {})).toBe(false)
  })

  it("lets the user's toggle override the default", () => {
    expect(isFolderOpen('bi', { bi: true })).toBe(true)
    expect(isFolderOpen('works', { works: false })).toBe(false)
  })
})
