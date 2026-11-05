/**
 * Drift check for the two hand-edited CV files (web/public/cv/CV_EN.html + CV_VN.html): they must keep the same
 * structure and the same links, only the words differ. Parses the HTML with parse5 (a real HTML parser) and compares
 * a small "shape" of each file. Used by scripts/check-cv-html.ts.
 */
import { parse } from 'parse5'

/** Minimal view of parse5's default tree nodes (avoids importing its internal types). */
interface Node {
  nodeName: string
  attrs?: { name: string; value: string }[]
  childNodes?: Node[]
}

export interface CvShape {
  /** class names of every <section>, in document order */
  sections: string[]
  /** number of bullets (<li>) of each job (<article class="job">), in order */
  jobs: number[]
  projects: number
  skills: number
  certifications: number
  degrees: number
  languages: number
  /** every link href, normalised (see normalizeHref), sorted, without duplicates */
  hrefs: string[]
}

const SITE_PAGE = /^https:\/\/voanhduy1710\.vercel\.app\/(?:en|vi)(?=\/|$)/

/** Website page links may differ only in their language: /en/projects/x (EN CV) = /vi/projects/x (VN CV). */
export function normalizeHref(href: string): string {
  return href.trim().replace(SITE_PAGE, 'https://voanhduy1710.vercel.app/{lang}')
}

function attr(n: Node, name: string): string | undefined {
  return n.attrs?.find((a) => a.name === name)?.value
}

function hasClass(n: Node, cls: string): boolean {
  return (attr(n, 'class') ?? '').split(/\s+/).includes(cls)
}

function all(root: Node, pred: (n: Node) => boolean, out: Node[] = []): Node[] {
  for (const c of root.childNodes ?? []) {
    if (pred(c)) out.push(c)
    all(c, pred, out)
  }
  return out
}

const tag = (name: string) => (n: Node) => n.nodeName === name

/** The first element with the given tag + class (anywhere below root). */
function find(root: Node, name: string, cls: string): Node | undefined {
  return all(root, (n) => n.nodeName === name && hasClass(n, cls))[0]
}

function countIn(root: Node, sectionClass: string, itemTag: string): number {
  const s = find(root, 'section', sectionClass)
  return s ? all(s, tag(itemTag)).length : 0
}

export function cvShape(html: string): CvShape {
  const doc = parse(html) as unknown as Node
  const cv = find(doc, 'main', 'cv') ?? doc
  return {
    sections: all(cv, tag('section')).map((s) => attr(s, 'class') ?? '(no class)'),
    jobs: all(cv, (n) => n.nodeName === 'article' && hasClass(n, 'job')).map((j) => all(j, tag('li')).length),
    projects: countIn(cv, 'projects', 'li'),
    skills: countIn(cv, 'skills', 'dt'),
    certifications: countIn(cv, 'certifications', 'li'),
    degrees: all(cv, (n) => hasClass(n, 'degree')).length,
    languages: countIn(cv, 'languages', 'li'),
    hrefs: [...new Set(all(cv, (n) => n.nodeName === 'a' && attr(n, 'href') !== undefined).map((a) => normalizeHref(attr(a, 'href')!)))].sort(),
  }
}

/** Human-readable differences between two CV shapes (empty = no drift). */
export function compareCvShapes(a: CvShape, b: CvShape, nameA = 'EN', nameB = 'VN'): string[] {
  const out: string[] = []
  const num = (what: string, x: number, y: number) => {
    if (x !== y) out.push(`${what}: ${nameA} has ${x}, ${nameB} has ${y}`)
  }
  num('sections', a.sections.length, b.sections.length)
  if (a.sections.length === b.sections.length && a.sections.join('|') !== b.sections.join('|')) {
    out.push(`section order/classes differ: ${nameA} [${a.sections.join(', ')}] vs ${nameB} [${b.sections.join(', ')}]`)
  }
  num('jobs', a.jobs.length, b.jobs.length)
  for (let i = 0; i < Math.min(a.jobs.length, b.jobs.length); i++) num(`bullets of job ${i + 1}`, a.jobs[i], b.jobs[i])
  num('projects', a.projects, b.projects)
  num('skills rows', a.skills, b.skills)
  num('certifications', a.certifications, b.certifications)
  num('degrees', a.degrees, b.degrees)
  num('languages', a.languages, b.languages)
  const inB = new Set(b.hrefs)
  const inA = new Set(a.hrefs)
  for (const h of a.hrefs) if (!inB.has(h)) out.push(`link only in ${nameA}: ${h}`)
  for (const h of b.hrefs) if (!inA.has(h)) out.push(`link only in ${nameB}: ${h}`)
  return out
}

export function compareCvHtml(htmlA: string, htmlB: string, nameA = 'EN', nameB = 'VN'): string[] {
  return compareCvShapes(cvShape(htmlA), cvShape(htmlB), nameA, nameB)
}
