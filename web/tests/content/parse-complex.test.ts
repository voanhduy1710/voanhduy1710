import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { inlineText } from '@/lib/content/inline'
import { extractSections } from '@/lib/content/markers'
import { parseShieldsBadge } from '@/lib/content/parse/badges'
import { parseExperience } from '@/lib/content/parse/experience'
import { parsePreviews } from '@/lib/content/parse/previews'
import { parseProjects } from '@/lib/content/parse/projects'

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8')
}

const en = extractSections(fixture('README.md'), 'README.md')
const vi = extractSections(fixture('READMEVN.md'), 'READMEVN.md')

const SLUGS = [
  'atino-booking',
  'caro-app',
  'qandastudy-booking',
  'atino-approval-web',
  'atino-approval-api',
  'atino-workspace',
  'data-analyst-portfolio',
]

describe('parseExperience', () => {
  it('reads company, role, period, location and bullets', () => {
    const exp = parseExperience(en.experience, 'README.md')
    expect(exp.map((e) => e.company)).toEqual(['Atino Fashion Co., Ltd.', 'VWS Joint Stock Company', 'Mosvodokanal'])
    expect(exp[0]).toMatchObject({ role: 'Full-Stack & Data Specialist', period: '2024 – Present', location: 'Hanoi, Vietnam' })
    expect(exp[0].bullets).toHaveLength(4)
    expect(exp[1].role).toBe('Technical Data Analyst | Information Technology Department')
    expect(exp[2]).toMatchObject({ period: '2018 – 2021', location: 'Moscow, Russia' })
    expect(exp[2].bullets).toHaveLength(2)
  })

  it('keeps bold inside bullets', () => {
    const first = parseExperience(en.experience, 'README.md')[0].bullets[0]
    expect(first[0]).toEqual({ kind: 'text', value: 'Built a full-stack financial web application (' })
    expect(first[1]).toEqual({ kind: 'strong', children: [{ kind: 'text', value: 'React' }] })
    expect(inlineText(first)).toMatch(/duplicate payment requests\.$/)
  })

  it('reads the Vietnamese file', () => {
    const exp = parseExperience(vi.experience, 'READMEVN.md')
    expect(exp).toHaveLength(3)
    expect(exp[0]).toMatchObject({ company: 'Công ty TNHH Thời trang Atino', period: '2024 – Hiện tại', location: 'Hà Nội, Việt Nam' })
  })

  it('accepts the italic line on its own paragraph', () => {
    expect(parseExperience('### Co\n**Dev**\n\n*2020 | Remote*\n- x', 'f')[0]).toMatchObject({
      role: 'Dev',
      period: '2020',
      location: 'Remote',
      bullets: [[{ kind: 'text', value: 'x' }]],
    })
  })

  it('throws naming the company when the italic line is missing', () => {
    expect(() => parseExperience('### X\n- a', 'README.md')).toThrow(/\[README\.md\].*X/)
    expect(() => parseExperience('### Y\n**Dev**\n*2020 Remote*', 'README.md')).toThrow(/\[README\.md\].*Y.*\|/)
  })

  it('throws when there are no entries', () => {
    expect(() => parseExperience('## Experience', 'README.md')).toThrow(/\[README\.md\].*experience/)
  })
})

describe('parseShieldsBadge', () => {
  it('decodes label, message and named colour', () => {
    expect(parseShieldsBadge('https://img.shields.io/badge/Node.js-18%2B-green.svg', 'Node.js')).toMatchObject({
      label: 'Node.js',
      message: '18+',
      color: '#97ca00',
    })
  })

  it('treats _ as space, keeps hex colour as written', () => {
    expect(parseShieldsBadge('https://img.shields.io/badge/Power_BI-DAX_%26_Modeling-F2C811.svg', 'Power BI')).toMatchObject({
      label: 'Power BI',
      message: 'DAX & Modeling',
      color: '#F2C811',
    })
  })

  it('treats -- as a literal dash and __ as a literal underscore', () => {
    expect(parseShieldsBadge('https://img.shields.io/badge/a--b-c__d_e-blue', 'x')).toEqual({
      label: 'a-b',
      message: 'c_d e',
      color: '#007ec6',
      alt: 'x',
    })
  })

  it('joins extra parts into the label and keeps href', () => {
    expect(parseShieldsBadge('https://img.shields.io/badge/Express-5-black.svg', 'Express', 'https://expressjs.com/')).toEqual({
      label: 'Express',
      message: '5',
      color: '#000000',
      href: 'https://expressjs.com/',
      alt: 'Express',
    })
    expect(parseShieldsBadge('https://img.shields.io/badge/WebRTC%20%2F%20PeerJS-orange.svg', 'WebRTC').label).toBe('WebRTC')
  })

  it('keeps the trimmed alt text, and leaves it out when empty', () => {
    expect(parseShieldsBadge('https://img.shields.io/badge/Database-Supabase-green', ' Supabase ').alt).toBe('Supabase')
    expect(parseShieldsBadge('https://img.shields.io/badge/Database-Supabase-green', '  ')).not.toHaveProperty('alt')
  })

  it('rejects non-badge URLs and unknown colours', () => {
    expect(() => parseShieldsBadge('https://example.com/x.svg', 'x')).toThrow(/shields/)
    expect(() => parseShieldsBadge('https://img.shields.io/badge/a-b-mauve.svg', 'x')).toThrow(/mauve/)
    expect(() => parseShieldsBadge('https://img.shields.io/badge/green.svg', 'x')).toThrow(/badge/)
  })
})

describe('parseProjects', () => {
  const projects = parseProjects(en.projects, 'README.md')

  it('reads slugs, titles and links', () => {
    expect(projects.map((p) => p.slug)).toEqual(SLUGS)
    expect(projects[1]).toMatchObject({
      title: 'Caro Web App',
      repoUrl: 'https://github.com/voanhduy1710/Caro-app',
      liveUrl: 'https://league-of-caro.vercel.app/',
      liveLabel: 'Live Application',
    })
    expect(projects[0]).toMatchObject({ liveUrl: 'https://giacong.atino.vn/', liveLabel: 'Live Platform' })
    expect(projects[0].note).toBeUndefined()
  })

  it('reads the private note', () => {
    expect(projects[2].note).toMatch(/^Private \(NDA\)/)
    expect(projects[2].liveUrl).toBeUndefined()
    expect(projects[2].repoUrl).toBe('https://github.com/voanhduy1710/Other-private-repo-previews/tree/main/1.%20QandaStudy-booking-webapp')
  })

  it('reads groups from the nearest ### heading', () => {
    expect(projects.slice(0, 6).every((p) => p.group === 'Full-Stack Applications & Production Systems')).toBe(true)
    expect(projects[6].group).toBe('Data Analytics & Business Intelligence')
  })

  it('reads badges with links', () => {
    expect(projects[0].badges).toHaveLength(8)
    expect(projects[0].badges[0]).toEqual({ label: 'Node.js', message: '18+', color: '#97ca00', href: 'https://nodejs.org/', alt: 'Node.js' })
    expect(projects[1].badges[0].alt).toBe('Node.js')
    expect(projects[1].badges[5]).toMatchObject({ label: 'Networking', message: 'WebRTC / PeerJS', color: '#fe7d37' })
    expect(projects[6].badges[4]).toMatchObject({ label: 'Automation', message: 'Google Apps Script' })
  })

  it('separates description paragraphs from bullets', () => {
    expect(projects[0].description).toEqual([])
    expect(projects[0].bullets).toHaveLength(3)
    expect(projects[6].description).toHaveLength(1)
    expect(inlineText(projects[6].description[0])).toMatch(/^A curated collection/)
    expect(projects[6].bullets).toHaveLength(4)
    expect(projects[6].bullets[0][0]).toMatchObject({ kind: 'strong' })
    expect(projects[6].note).toBeUndefined()
  })

  it('takes Vietnamese titles from #### headings', () => {
    const p = parseProjects(vi.projects, 'READMEVN.md')
    expect(p.map((x) => x.slug)).toEqual(SLUGS)
    expect(p[2].title).toBe('Nền tảng Đặt lịch Studio QandaStudy')
    expect(p[0].liveLabel).toBe('Nền tảng trực tuyến')
    expect(p[6].group).toBe('Phân tích Dữ liệu & Business Intelligence')
  })

  it('throws naming the slug for a missing or unlinked title', () => {
    expect(() => parseProjects('### G\n<!-- project: a -->\nno heading', 'README.md')).toThrow(/\[README\.md\].*projects.*a/)
    expect(() => parseProjects('### G\n<!-- project: a -->\n#### Plain', 'README.md')).toThrow(/\[README\.md\].*a.*link/)
  })

  it('throws when a project has no group or there are no projects', () => {
    expect(() => parseProjects('<!-- project: a -->\n#### [A](u)', 'README.md')).toThrow(/\[README\.md\].*a.*###/)
    expect(() => parseProjects('## Projects', 'README.md')).toThrow(/\[README\.md\].*projects/)
  })

  it('throws when a project block holds a second #### heading (a forgotten or broken marker)', () => {
    const md = '### G\n<!-- project: a -->\n#### [A](u)\n\ntext\n\n#### [B](v)\n\nmore'
    expect(() => parseProjects(md, 'README.md')).toThrow(
      '[README.md] projects: project a has more than one #### heading – missing marker?',
    )
    // a sloppy marker no longer silently merges two projects: it is either parsed or rejected
    const sloppy = '### G\n<!-- project: a -->\n#### [A](u)\n<!-- project : b -->\n#### [B](v)'
    expect(parseProjects(sloppy, 'README.md').map((p) => p.title)).toEqual(['A', 'B'])
  })

  it('wraps bad badges in a ContentError naming the slug', () => {
    const md = '### G\n<!-- project: a -->\n#### [A](u)\n\n[![x](https://img.shields.io/badge/a-b-mauve.svg)](h)'
    expect(() => parseProjects(md, 'README.md')).toThrow(/\[README\.md\].*a.*mauve/)
  })
})

describe('parsePreviews', () => {
  it('reads URI-decoded image paths per slug', () => {
    const prev = parsePreviews(en.previews, 'README.md')
    expect(prev.map((p) => p.slug)).toEqual(SLUGS.slice(0, 6))
    expect(prev.find((p) => p.slug === 'qandastudy-booking')!.images[0].src).toBe(
      'web/public/previews/Other-private-repo-previews/1. QandaStudy-booking-webapp/Preview_0.png',
    )
    expect(prev[0].images).toEqual([
      { src: 'web/public/previews/Atino-booking-webapp/Preview_1.png', alt: 'Atino Booking Preview 1' },
      { src: 'web/public/previews/Atino-booking-webapp/Preview_2.png', alt: 'Atino Booking Preview 2' },
    ])
    expect(parsePreviews(vi.previews, 'READMEVN.md')).toEqual(prev)
  })

  it('throws naming the slug when a block has no images', () => {
    expect(() => parsePreviews('<!-- project: a -->\n### A', 'README.md')).toThrow(/\[README\.md\].*previews.*a/)
  })
})
