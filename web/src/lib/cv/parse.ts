/**
 * Parses and validates the CV YAML files (pure: no file access, so the content sync, the site and the tests share it).
 * Every problem is collected and reported at once, each with the file, the field path and the line, e.g.
 * `[public/cv/cv.en.yaml] experience[1].bullets[0] (line 52): expected text, got a number (put it in quotes)`.
 */
import { isNode, LineCounter, parseDocument, type Document } from 'yaml'
import { ContentError } from '../content/errors'
import { toInline, trimInline } from '../content/inline'
import { toMdast } from '../content/mdast'
import type { Inline, Lang } from '../content/types'
import type {
  CvCertification,
  CvContact,
  CvDegree,
  CvEducation,
  CvExperience,
  CvLanguage,
  CvModel,
  CvProject,
  CvSkillCategory,
} from './types'

/** The two CV files, relative to the website folder `web/` (deployed with it; also served at `/cv/cv.en.yaml`). */
export const CV_FILES: Record<Lang, string> = { en: 'public/cv/cv.en.yaml', vi: 'public/cv/cv.vi.yaml' }

type Path = (string | number)[]
type Rec = Record<string, unknown>

const WEB_URL = /^https?:\/\/[^\s]+$/i
const LINK_HREF = /^(https?:\/\/|mailto:)[^\s]+$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function pathText(path: Path): string {
  return path.reduce<string>((s, p) => (typeof p === 'number' ? `${s}[${p}]` : s ? `${s}.${p}` : p), '') || '(top level)'
}

function kindOf(v: unknown): string {
  if (v === null || v === undefined) return 'nothing'
  if (Array.isArray(v)) return 'a list'
  if (typeof v === 'object') return 'a group of fields'
  return `a ${typeof v}`
}

/** Collects every problem of one file, each tagged with its field path and (when known) its line. */
class Checker {
  readonly problems: string[] = []

  constructor(
    private readonly doc: Document,
    private readonly lines: LineCounter,
  ) {}

  fail(path: Path, message: string): void {
    const node = path.length > 0 ? this.doc.getIn(path, true) : this.doc.contents
    const start = isNode(node) ? node.range?.[0] : undefined
    const line = start !== undefined ? ` (line ${this.lines.linePos(start).line})` : ''
    this.problems.push(`${pathText(path)}${line}: ${message}`)
  }

  /** A group of fields; reports fields it does not know (typos such as `bulets`). */
  record(v: unknown, path: Path, allowed: readonly string[]): Rec | undefined {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      this.fail(path, `expected a group of fields (${allowed.join(', ')}), got ${kindOf(v)}`)
      return undefined
    }
    for (const key of Object.keys(v)) {
      if (!allowed.includes(key)) this.fail([...path, key], `unknown field "${key}" (allowed here: ${allowed.join(', ')})`)
    }
    return v as Rec
  }

  text(rec: Rec, key: string, path: Path, optional = false): string | undefined {
    const v = rec[key]
    const at = [...path, key]
    if (v === undefined || v === null) {
      if (!optional) this.fail(at, 'missing (required)')
      return undefined
    }
    return this.scalar(v, at)
  }

  /** A non-empty piece of text. Numbers / true / false are refused: YAML reads `2024` or `yes` as such. */
  scalar(v: unknown, path: Path): string | undefined {
    if (typeof v !== 'string') {
      const hint = typeof v === 'number' || typeof v === 'boolean' ? ' (put it in quotes)' : ''
      this.fail(path, `expected text, got ${kindOf(v)}${hint}`)
      return undefined
    }
    const s = v.trim()
    if (!s) {
      this.fail(path, 'is empty')
      return undefined
    }
    return s
  }

  url(rec: Rec, key: string, path: Path): string | undefined {
    const s = this.text(rec, key, path, true)
    if (s !== undefined && !WEB_URL.test(s)) this.fail([...path, key], `expected a web address starting with https://, got "${s}"`)
    return s
  }

  /** A list; `optional` lists may be left out, but a list that is present must not be empty. */
  list(rec: Rec, key: string, path: Path, optional = false): unknown[] {
    const v = rec[key]
    const at = [...path, key]
    if (v === undefined || v === null) {
      if (!optional) this.fail(at, 'missing (required list)')
      return []
    }
    if (!Array.isArray(v)) {
      this.fail(at, `expected a list (lines starting with "- "), got ${kindOf(v)}`)
      return []
    }
    if (v.length === 0) this.fail(at, optional ? 'is an empty list (remove the field to leave the section out)' : 'is an empty list')
    return v
  }

  texts(rec: Rec, key: string, path: Path): string[] {
    return this.list(rec, key, path).flatMap((v, i) => this.scalar(v, [...path, key, i]) ?? [])
  }

  /** One line of inline markdown: `**bold**`, `*italic*`, `` `code` ``, `[text](https://...)`; no lists or headings. */
  markdown(v: unknown, path: Path): Inline[] {
    const s = this.scalar(v, path)
    if (s === undefined) return []
    const root = toMdast(s)
    const [first, ...rest] = root.children
    if (first?.type !== 'paragraph' || rest.length > 0) {
      this.fail(path, 'only one line of text is allowed here (**bold**, *italic*, [link](https://...)); no lists, headings or blank lines')
      return []
    }
    const inline = trimInline(toInline(first.children))
    this.checkLinks(inline, path)
    return inline
  }

  private checkLinks(nodes: Inline[], path: Path): void {
    for (const n of nodes) {
      if (n.kind === 'link' && !LINK_HREF.test(n.href)) this.fail(path, `link "${n.href}" must start with https:// or mailto:`)
      if ('children' in n) this.checkLinks(n.children, path)
    }
  }

  markdowns(rec: Rec, key: string, path: Path): Inline[][] {
    return this.list(rec, key, path).map((v, i) => this.markdown(v, [...path, key, i]))
  }
}

const TOP = ['name', 'title', 'contact', 'summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'languages'] as const
const CONTACT = ['email', 'phone', 'location', 'website', 'github', 'linkedin'] as const

function parseContact(c: Checker, v: unknown): CvContact {
  const path = ['contact']
  const rec = c.record(v, path, CONTACT)
  if (!rec) return {}
  const out: CvContact = {
    email: c.text(rec, 'email', path, true),
    phone: c.text(rec, 'phone', path, true),
    location: c.text(rec, 'location', path, true),
    website: c.url(rec, 'website', path),
    github: c.url(rec, 'github', path),
    linkedin: c.url(rec, 'linkedin', path),
  }
  if (out.email !== undefined && !EMAIL.test(out.email)) c.fail([...path, 'email'], `"${out.email}" is not an email address`)
  if (Object.values(out).every((x) => x === undefined)) c.fail(path, 'needs at least one of: email, phone, ...')
  return Object.fromEntries(Object.entries(out).filter(([, x]) => x !== undefined)) as CvContact
}

/** Maps each item of `rec[key]` (a list of field groups) with `fn`, skipping items that are not field groups. */
function items<T>(c: Checker, rec: Rec, key: string, allowed: readonly string[], fn: (r: Rec, path: Path) => T, optional = false): T[] {
  return c.list(rec, key, [], optional).flatMap((v, i) => {
    const r = c.record(v, [key, i], allowed)
    return r ? [fn(r, [key, i])] : []
  })
}

/**
 * Parses one CV file. Throws a `ContentError` naming the file and listing every problem (YAML syntax, missing or
 * unknown fields, wrong kinds of value, bad links) with its field path and line.
 */
export function parseCv(yamlText: string, lang: Lang, file: string): CvModel {
  const lines = new LineCounter()
  const doc = parseDocument(yamlText, { lineCounter: lines, prettyErrors: true, uniqueKeys: true })
  if (doc.errors.length > 0) {
    throw new ContentError(file, `invalid YAML:\n  ${doc.errors.map((e) => e.message.split('\n')[0]).join('\n  ')}`)
  }
  const c = new Checker(doc, lines)
  const top = c.record(doc.toJS(), [], TOP)
  if (!top) throw new ContentError(file, `invalid CV:\n  ${c.problems.join('\n  ')}`)

  const model: CvModel = {
    lang,
    name: c.text(top, 'name', []) ?? '',
    title: c.text(top, 'title', []) ?? '',
    contact: top.contact === undefined ? (c.fail(['contact'], 'missing (required)'), {}) : parseContact(c, top.contact),
    summary: c.markdowns(top, 'summary', []),
    skills: items(c, top, 'skills', ['category', 'items'], (r, p): CvSkillCategory => ({
      category: c.text(r, 'category', p) ?? '',
      items: c.texts(r, 'items', p),
    })),
    experience: items(c, top, 'experience', ['role', 'company', 'location', 'period', 'bullets'], (r, p): CvExperience => ({
      role: c.text(r, 'role', p) ?? '',
      company: c.text(r, 'company', p) ?? '',
      ...optionalText(c, r, 'location', p),
      period: c.text(r, 'period', p) ?? '',
      bullets: c.markdowns(r, 'bullets', p),
    })),
    projects: items(
      c,
      top,
      'projects',
      ['name', 'link', 'tech', 'description'],
      (r, p): CvProject => {
        const link = c.url(r, 'link', p)
        return {
          name: c.text(r, 'name', p) ?? '',
          ...(link !== undefined && { link }),
          tech: c.texts(r, 'tech', p),
          description: r.description === undefined ? (c.fail([...p, 'description'], 'missing (required)'), []) : c.markdown(r.description, [...p, 'description']),
        }
      },
      true,
    ),
    education: items(c, top, 'education', ['school', 'location', 'degrees'], (r, p): CvEducation => ({
      school: c.text(r, 'school', p) ?? '',
      ...optionalText(c, r, 'location', p),
      degrees: c.list(r, 'degrees', p).flatMap((v, i): CvDegree[] => {
        const dp = [...p, 'degrees', i]
        const d = c.record(v, dp, ['degree', 'detail', 'period', 'note'])
        if (!d) return []
        return [
          {
            degree: c.text(d, 'degree', dp) ?? '',
            ...optionalText(c, d, 'detail', dp),
            ...optionalText(c, d, 'period', dp),
            ...optionalText(c, d, 'note', dp),
          },
        ]
      }),
    })),
    certifications: items(
      c,
      top,
      'certifications',
      ['name', 'issuer', 'link', 'status'],
      (r, p): CvCertification => {
        const link = c.url(r, 'link', p)
        return {
          name: c.text(r, 'name', p) ?? '',
          ...optionalText(c, r, 'issuer', p),
          ...(link !== undefined && { link }),
          status: c.text(r, 'status', p) ?? '',
        }
      },
      true,
    ),
    languages: items(c, top, 'languages', ['name', 'level'], (r, p): CvLanguage => ({ name: c.text(r, 'name', p) ?? '', level: c.text(r, 'level', p) ?? '' }), true),
  }
  if (c.problems.length > 0) throw new ContentError(file, `invalid CV (${c.problems.length} problem${c.problems.length > 1 ? 's' : ''}):\n  ${c.problems.join('\n  ')}`)
  return model
}

function optionalText<K extends string>(c: Checker, r: Rec, key: K, p: Path): Partial<Record<K, string>> {
  const v = c.text(r, key, p, true)
  return v === undefined ? {} : ({ [key]: v } as Record<K, string>)
}

/** Structure both languages must share (the text is translated, the structure is not). */
function shapeOf(cv: CvModel): [string, string | number][] {
  const join = (xs: (string | undefined)[]) => xs.map((x) => x ?? '-').join(' | ')
  return [
    ['contact fields', join(CONTACT.filter((k) => cv.contact[k] !== undefined))],
    // Untranslated contact values must be identical.
    ...(['email', 'phone', 'website', 'github', 'linkedin'] as const).map((k): [string, string] => [`contact.${k}`, cv.contact[k] ?? '-']),
    ['summary paragraphs', cv.summary.length],
    ['skills categories', cv.skills.length],
    ...cv.skills.map((s, i): [string, number] => [`skills[${i}] items`, s.items.length]),
    ['experience entries', cv.experience.length],
    ...cv.experience.map((e, i): [string, number] => [`experience[${i}] bullets`, e.bullets.length]),
    ['projects', cv.projects.length],
    ...cv.projects.map((p, i): [string, string] => [`projects[${i}] tech`, p.tech.join(', ')]),
    ...cv.projects.map((p, i): [string, string] => [`projects[${i}] link`, p.link ?? '-']),
    ['education schools', cv.education.length],
    ...cv.education.map((s, i): [string, number] => [`education[${i}] degrees`, s.degrees.length]),
    ['certifications', cv.certifications.length],
    ...cv.certifications.map((x, i): [string, string] => [`certifications[${i}] link`, x.link ?? '-']),
    ['languages', cv.languages.length],
  ]
}

/** Throws a `ContentError` listing every structural difference between the EN and VI CV (counts, links, tech lists). */
export function validateCvPair(en: CvModel, vi: CvModel): void {
  const [enFile, viFile] = [CV_FILES.en, CV_FILES.vi]
  const viShape = new Map(shapeOf(vi))
  const enShape = new Map(shapeOf(en))
  const keys = [...new Set([...enShape.keys(), ...viShape.keys()])]
  const diffs = keys
    .filter((k) => enShape.get(k) !== viShape.get(k))
    .map((k) => `${k}: ${enFile} has ${JSON.stringify(enShape.get(k) ?? 'nothing')}, ${viFile} has ${JSON.stringify(viShape.get(k) ?? 'nothing')}`)
  if (diffs.length > 0) {
    throw new ContentError(`${enFile} + ${viFile}`, `EN/VI CV differs (both files must have the same structure):\n  ${diffs.join('\n  ')}`)
  }
}

/** Parses both files and checks they match (the site loader and the tests). */
export function parseCvPair(texts: Record<Lang, string>): Record<Lang, CvModel> {
  const pair = { en: parseCv(texts.en, 'en', CV_FILES.en), vi: parseCv(texts.vi, 'vi', CV_FILES.vi) }
  validateCvPair(pair.en, pair.vi)
  return pair
}
