/**
 * The analytics project's README (voanhduy1710/Portfolio-projects) split into one section per analysis, so each gets
 * its own page. Pure (no file or network access): the content sync uses it to pick the repo files the analyses link
 * to, the pages and the explorer to list and render them, the link checker to know which routes must exist.
 *
 * Shape it expects (both README.md and READMEVN.md):
 *
 *   # Title / intro ...                  -> `intro`
 *   ## Projects Overview                 -> the first `##` that holds numbered `###` headings (`heading`)
 *   (text before the first `###`)        -> `lead`
 *   ### 1. Atino Sales Dashboard ...     -> one `AnalysisSection` per numbered `###`, up to the next `###` / `##` / `#`
 *   ## Tools & Programs / ## Contact     -> `rest`
 *
 * Headings inside fenced code blocks are ignored. The analysis slugs come from the English titles; the Vietnamese
 * README's sections are matched to them by number (`### 3.` in both), so /en and /vi share every URL.
 */
import type { Element, Root, RootContent, ElementContent } from 'hast'
import { sanitizedTree } from './render'
import { isRepoRelative, resolveRepoPath, type ReadmeSource } from './source'

export type AnalysisSection = {
  /** The number in `### 3. Uber Trips` (as written, e.g. `3`). */
  number: string
  /** The heading text after the number (`Uber Trips`). */
  title: string
  /** Markdown between this heading and the next one of level 1-3 (the heading itself excluded). */
  body: string
}

export type SplitReadme = {
  /** Everything before the overview heading (the README's H1, intro text). */
  intro: string
  /** Text of the overview `##` heading (`Projects Overview` / `Tổng quan dự án`). */
  heading: string
  /** Text between the overview heading and its first numbered `###`. */
  lead: string
  sections: AnalysisSection[]
  /** Everything from the next `##` / `#` after the last section (Tools & Programs, Contact). */
  rest: string
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const NUMBERED = /^(\d+)[.)][ \t]+(.+)$/

type Line = { text: string; level?: number; heading?: string }

/** The lines of a markdown text, each heading (outside fenced code) tagged with its level and text. */
function scan(markdown: string): Line[] {
  let fence: string | undefined
  return markdown.split(/\r?\n/).map((text): Line => {
    const f = FENCE.exec(text)
    if (fence !== undefined) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && text.trim() === f[1]) fence = undefined
      return { text }
    }
    if (f) {
      fence = f[1]
      return { text }
    }
    const h = ATX.exec(text)
    return h ? { text, level: h[1].length, heading: (h[2] ?? '').trim() } : { text }
  })
}

const join = (lines: Line[]) => lines.map((l) => l.text).join('\n').trim()

/**
 * The README split around its first `##` section that holds numbered `###` headings; undefined when it has none
 * (then the README is shown whole, as before).
 */
export function splitAnalyses(markdown: string): SplitReadme | undefined {
  const lines = scan(markdown)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].level !== 2) continue
    let end = i + 1
    while (end < lines.length && !(lines[end].level !== undefined && lines[end].level! <= 2)) end++
    const starts: { at: number; number: string; title: string }[] = []
    for (let j = i + 1; j < end; j++) {
      const m = lines[j].level === 3 ? NUMBERED.exec(lines[j].heading!) : null
      if (m) starts.push({ at: j, number: m[1], title: m[2].trim() })
    }
    if (starts.length === 0) {
      i = end - 1
      continue
    }
    const sections = starts.map((s, k): AnalysisSection => {
      const stop = k + 1 < starts.length ? starts[k + 1].at : end
      return { number: s.number, title: s.title, body: join(lines.slice(s.at + 1, stop)) }
    })
    return {
      intro: join(lines.slice(0, i)),
      heading: lines[i].heading!,
      lead: join(lines.slice(i + 1, starts[0].at)),
      sections,
      rest: join(lines.slice(end)),
    }
  }
  return undefined
}

/** URL slug of a title: lower-case ASCII words joined by `-` (`Excel – Adidas Sales` -> `excel-adidas-sales`). */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Section number -> slug, from the English README's titles (unique: a repeated slug gets `-2`, `-3`...). */
export function analysisSlugs(sections: readonly AnalysisSection[]): Map<string, string> {
  const out = new Map<string, string>()
  const used = new Set<string>()
  for (const s of sections) {
    if (out.has(s.number)) continue
    const base = slugify(s.title) || `analysis-${s.number}`
    let slug = base
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`
    used.add(slug)
    out.set(s.number, slug)
  }
  return out
}

/**
 * Every heading of level `from` or deeper moved up/down by `delta` levels (clamped to 1..6), outside fenced code.
 * The analysis page shows `### 3. Uber Trips` as its H1, so the section's `####` sub-sections become `##`.
 */
export function shiftHeadings(markdown: string, delta: number): string {
  return scan(markdown)
    .map((l) => {
      if (l.level === undefined) return l.text
      const level = Math.min(6, Math.max(1, l.level + delta))
      return l.text.replace(/^( {0,3})#{1,6}/, `$1${'#'.repeat(level)}`)
    })
    .join('\n')
}

const isElement = (n: RootContent | ElementContent): n is Element => n.type === 'element'

/** The `href` of every link in a markdown text (after sanitising, so only links the page could show), in order. */
export function linkHrefs(markdown: string): string[] {
  const out: string[] = []
  const visit = (node: Root | Element) => {
    for (const c of node.children) {
      if (!isElement(c)) continue
      if (c.tagName === 'a' && typeof c.properties.href === 'string') out.push(c.properties.href.trim())
      visit(c)
    }
  }
  visit(sanitizedTree(markdown))
  return out
}

const POWER_BI = /^https:\/\/app\.powerbi\.com\//i
/**
 * The README's "Interactive dashboard can be found [here](url)" / "Xem dashboard tương tác [tại đây](url)" sentence:
 * the first https link after the phrase, in the same sentence. Catches a dashboard behind a short link
 * (`https://bit.ly/...`), which the app.powerbi.com test cannot see.
 */
const DASHBOARD_SENTENCE = /(?:interactive\s+dashboard|dashboard\s+tương\s+tác)[^.\n]*?\]\(\s*<?(https:\/\/[^\s)>]+)/iu

/**
 * The section's interactive (Power BI) dashboard: the first `https://app.powerbi.com/...` link, else the link of its
 * "Interactive dashboard ... [here](url)" sentence; undefined if neither. Only links the sanitised page keeps count.
 */
/**
 * The section text without the paragraph that holds the "Interactive dashboard ... [here](url)" sentence: the page
 * shows that link as its "Open interactive dashboard" button, so the sentence (and anything else in its paragraph,
 * e.g. a "Full details: ..." link) is not repeated in the body. Paragraphs are blank-line separated blocks; fenced
 * code is never touched. Unchanged when there is no such sentence.
 */
export function withoutDashboardParagraph(markdown: string): string {
  const blocks: string[][] = [[]]
  let fence: string | undefined
  for (const line of markdown.split(/\r?\n/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker && (!fence || marker.startsWith(fence))) fence = fence ? undefined : marker
    if (!fence && !marker && line.trim() === '') blocks.push([])
    else blocks[blocks.length - 1].push(line)
  }
  const kept = blocks.filter((b) => b.length > 0 && !(DASHBOARD_SENTENCE.test(b.join('\n')) && !/^\s*(`{3,}|~{3,})/.test(b[0])))
  return kept.map((b) => b.join('\n')).join('\n\n')
}

export function powerBiUrl(markdown: string): string | undefined {
  const hrefs = linkHrefs(markdown)
  const direct = hrefs.find((h) => POWER_BI.test(h))
  if (direct) return direct
  const named = DASHBOARD_SENTENCE.exec(markdown)?.[1]
  return named && hrefs.includes(named) ? named : undefined
}

/** Kinds of repo file an analysis may link to and the site shows in-page (an allow-list by extension). */
export type LinkedFileKind = 'markdown' | 'code'
const LINKED_FILE: [RegExp, LinkedFileKind][] = [
  [/\.(md|markdown)$/i, 'markdown'],
  [/\.(gs|js|mjs|ts|sql|py)$/i, 'code'],
]
const README_FILE = /(^|\/)README(VN)?\.md$/i

/** How a linked repo file is shown, or undefined if it is not one the site shows (images, folders, READMEs...). */
export function linkedFileKind(path: string): LinkedFileKind | undefined {
  if (README_FILE.test(path)) return undefined
  return LINKED_FILE.find(([re]) => re.test(path))?.[1]
}

/** Repo paths of the allow-listed files a section links to (repo-relative links only, inside the repo), deduped. */
export function linkedFiles(markdown: string, source: ReadmeSource): string[] {
  const out: string[] = []
  for (const href of linkHrefs(markdown)) {
    if (!isRepoRelative(href)) continue
    const path = resolveRepoPath(source.dir, href)
    if (path !== undefined && linkedFileKind(path) !== undefined && !out.includes(path)) out.push(path)
  }
  return out
}

/** In-page anchor of a linked file shown on its analysis page (`6. SQL_questions.md` -> `file-6-sql-questions-md`). */
export const fileAnchor = (path: string) => `file-${slugify(path) || 'linked'}`

/** Markup stripped to plain text, for a one-line card summary. */
function plain(line: string): string {
  return line
    .replace(/&nbsp;/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The section's first line of text (normally `Skills Used: ...`), as plain text; '' if it has none. */
export function sectionSummary(body: string): string {
  for (const l of scan(body)) {
    if (l.level !== undefined) continue
    const t = l.text.trim()
    if (t === '' || /^([-*+]|\d+\.)\s/.test(t) || t.startsWith('![') || t.startsWith('<') || t.startsWith('>')) continue
    const text = plain(t)
    if (text) return text
  }
  return ''
}

/** Icon keys an analysis can carry (a subset of the explorer's NavIcon). */
export type AnalysisIcon = 'powerbi' | 'sql' | 'appsscript' | 'excel'

/** The skills of a `Skills Used: A, B` / `Kỹ năng sử dụng: A, B` line, split on commas; [] if the line has none. */
export function skillsOf(summary: string): string[] {
  const m = /^[^:]{1,30}:\s*(.+)$/.exec(summary.trim())
  return m ? m[1].split(',').map((x) => x.trim()).filter(Boolean) : []
}

/**
 * Icon of an analysis from its skills line, first matching rule wins; `powerbi` is the default. To give another tool
 * its own icon (e.g. Excel), add a rule here and a glyph in components/shell/icons.tsx.
 */
const ICON_RULES: { icon: AnalysisIcon; test: (skills: string[]) => boolean }[] = [
  { icon: 'appsscript', test: (skills) => skills.some((s) => /apps\s*script/i.test(s)) },
  // SQL alone: a section that also lists Power BI or Excel stays a Power BI analysis.
  // Excel without Power BI: an Excel workbook analysis.
  { icon: 'excel', test: (skills) => skills.some((s) => /^excel$/i.test(s)) && !skills.some((s) => /power\s*bi/i.test(s)) },
  { icon: 'sql', test: (skills) => skills.some((s) => /^sql$/i.test(s)) && !skills.some((s) => /power\s*bi|excel/i.test(s)) },
]

export function analysisIcon(summary: string): AnalysisIcon {
  const skills = skillsOf(summary)
  return ICON_RULES.find((r) => r.test(skills))?.icon ?? 'powerbi'
}
