import { readFileSync } from 'node:fs'
import { contentPath } from '../contentDir'
import { cachedBySyncedFiles } from '../syncedCache'
import { assetUrl } from './assets'
import { ContentError } from './errors'
import { extractSections } from './markers'
import { decodeAssetPath } from './mdast'
import { parseCertifications } from './parse/certifications'
import { parseContact } from './parse/contact'
import { parseEducation } from './parse/education'
import { parseExperience } from './parse/experience'
import { parseHeader } from './parse/header'
import { parseLanguages } from './parse/languages'
import { parsePreviews } from './parse/previews'
import { parseProjects } from './parse/projects'
import { parseSkills } from './parse/skills'
import { parseSummary } from './parse/summary'
import { parseTechStack } from './parse/techStack'
import type {
  Certification,
  ContactItem,
  EducationData,
  ExperienceEntry,
  HeaderData,
  Inline,
  Lang,
  LanguageItem,
  PreviewSet,
  Project,
  SkillRow,
  TechItem,
} from './types'

export type SiteContent = {
  lang: Lang
  header: HeaderData
  summary: Inline[][]
  techStack: TechItem[]
  skills: SkillRow[]
  experience: ExperienceEntry[]
  projects: (Project & { images: PreviewSet['images'] })[]
  languages: LanguageItem[]
  education: EducationData
  contact: ContactItem[]
  certifications: Certification[]
  cvHref: { en: string; vi: string }
}

export const README_FILES: Record<Lang, string> = { en: 'README.md', vi: 'READMEVN.md' }

const WEBSITE_HOSTS = ['voanhduy1710.vercel.app', 'voanhduy1710.dev']
const CV_SUFFIX: Record<Lang, RegExp> = { en: /_EN\.pdf$/i, vi: /_VN\.pdf$/i }

/** The site's own address: links to it are dropped from the page (header links and contact items). */
const isSelfLink = (href: string) => WEBSITE_HOSTS.some((h) => href.includes(h))

function hasSelfLink(inlines: Inline[]): boolean {
  return inlines.some((i) =>
    i.kind === 'link' ? isSelfLink(i.href) || hasSelfLink(i.children) : 'children' in i && hasSelfLink(i.children),
  )
}

/** README-relative header hrefs (no scheme, no `#anchor`, no `/root` path) -> served URLs, e.g. the CV PDFs. */
function servedHref(href: string, file: string): string {
  if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) return href
  return assetUrl(decodeAssetPath(href, file, 'header'))
}

/** The (served) href of the header link that ends in `_EN.pdf` / `_VN.pdf`. */
function cvHrefOf(header: HeaderData, lang: Lang, file: string): string {
  const link = header.links.find(({ href }) => !/^[a-z][a-z0-9+.-]*:/i.test(href) && CV_SUFFIX[lang].test(href))
  if (link) return link.href
  throw new ContentError(file, `header: expected a CV link whose href ends in ${CV_SUFFIX[lang].source.replace(/\\|\$/g, '')}`)
}

/** Parses one README into the site's content model (pure: no file access). */
export function parseReadme(markdown: string, lang: Lang, file: string): SiteContent {
  const s = extractSections(markdown, file)
  const parsed = parseHeader(s.header, file)
  const links = parsed.links.filter((l) => !isSelfLink(l.href)).map((l) => ({ ...l, href: servedHref(l.href, file) }))
  const header = { ...parsed, links }

  const projects = parseProjects(s.projects, file)
  const previews = parsePreviews(s.previews, file)
  const slugs = new Set(projects.map((p) => p.slug))
  for (const p of previews) {
    if (!slugs.has(p.slug)) throw new ContentError(file, `preview for unknown project: ${p.slug}`)
  }
  const imagesOf = new Map(previews.map((p) => [p.slug, p.images]))

  return {
    lang,
    header,
    summary: parseSummary(s.summary, file),
    techStack: parseTechStack(s['tech-stack'], file),
    skills: parseSkills(s.skills, file),
    experience: parseExperience(s.experience, file),
    projects: projects.map((p) => ({ ...p, images: imagesOf.get(p.slug) ?? [] })),
    languages: parseLanguages(s.languages, file),
    education: parseEducation(s.education, file),
    contact: parseContact(s.contact, file).filter((c) => !hasSelfLink(c.value)),
    certifications: parseCertifications(s.certifications, file),
    cvHref: { en: cvHrefOf(header, 'en', file), vi: cvHrefOf(header, 'vi', file) },
  }
}

function onlyIn(a: string[], b: string[]): string[] {
  const other = new Set(b)
  return [...new Set(a)].filter((x) => !other.has(x))
}

const previewPaths = (c: SiteContent, slug: string) =>
  c.projects.find((p) => p.slug === slug)?.images.map((i) => i.src) ?? []

/** Item counts that must match between the languages (the text is translated, the structure is not). */
function countsOf(c: SiteContent): [string, number][] {
  return [
    ['experience entries', c.experience.length],
    ...c.experience.map((e, i): [string, number] => [`experience #${i + 1} bullets`, e.bullets.length]),
    ['certifications', c.certifications.length],
    ['languages', c.languages.length],
    ['skills rows', c.skills.length],
    ['education schools', c.education.length],
    ...c.education.map((s, i): [string, number] => [`education school #${i + 1} degrees`, s.degrees.length]),
    ['contact items', c.contact.length],
  ]
}

/** `what: README.md has 3, READMEVN.md has 2` for every count that differs (or exists in one language only). */
function countDiffs(en: SiteContent, vi: SiteContent, enFile: string, viFile: string): string[] {
  const viCounts = new Map(countsOf(vi))
  const enCounts = new Map(countsOf(en))
  const keys = [...new Set([...enCounts.keys(), ...viCounts.keys()])]
  return keys
    .filter((k) => enCounts.get(k) !== viCounts.get(k))
    .map((k) => `${k}: ${enFile} has ${enCounts.get(k) ?? 0}, ${viFile} has ${viCounts.get(k) ?? 0}`)
}

/**
 * Throws if the two languages disagree on project slugs, tech-stack logos, the preview images of any
 * project (compared per slug, so an image moved to another project is caught), the certification numbers or the
 * number of experience
 * entries / bullets, certifications, languages, skills rows, education schools / degrees and contact items,
 * listing every difference.
 */
export function validatePair(en: SiteContent, vi: SiteContent): void {
  const [enFile, viFile] = [README_FILES.en, README_FILES.vi]
  const enSlugs = en.projects.map((p) => p.slug)
  const viSlugs = vi.projects.map((p) => p.slug)
  const enLogos = en.techStack.map((t) => t.logo)
  const viLogos = vi.techStack.map((t) => t.logo)
  // The № of a certificate names its PDF and its page, so both languages must use the same numbers.
  const enCerts = en.certifications.map((c) => String(c.no))
  const viCerts = vi.certifications.map((c) => String(c.no))
  const problems: [string, string, string[]][] = [
    ['project slugs', enFile, onlyIn(enSlugs, viSlugs)],
    ['project slugs', viFile, onlyIn(viSlugs, enSlugs)],
    ['tech-stack logos', enFile, onlyIn(enLogos, viLogos)],
    ['tech-stack logos', viFile, onlyIn(viLogos, enLogos)],
    ['certification numbers', enFile, onlyIn(enCerts, viCerts)],
    ['certification numbers', viFile, onlyIn(viCerts, enCerts)],
  ]
  for (const slug of new Set([...enSlugs, ...viSlugs])) {
    const [a, b] = [previewPaths(en, slug), previewPaths(vi, slug)]
    problems.push([`preview images of ${slug}`, enFile, onlyIn(a, b)], [`preview images of ${slug}`, viFile, onlyIn(b, a)])
  }
  const [enHasStatus, viHasStatus] = [en.header.status !== undefined, vi.header.status !== undefined]
  if (enHasStatus !== viHasStatus) {
    problems.push(['header status', enHasStatus ? enFile : viFile, ['<!-- site: status = ... -->']])
  }
  const [enRoles, viRoles] = [en.header.roles.length, vi.header.roles.length]
  const lines = [
    ...(enRoles !== viRoles ? [`header roles: ${enFile} has ${enRoles}, ${viFile} has ${viRoles}`] : []),
    ...problems.filter(([, , list]) => list.length > 0).map(([what, file, list]) => `${what} only in ${file}: ${list.join(', ')}`),
    ...countDiffs(en, vi, enFile, viFile),
  ]
  if (lines.length > 0) throw new ContentError(`${enFile} + ${viFile}`, `EN/VI content differs:\n  ${lines.join('\n  ')}`)
}

const loadPair = cachedBySyncedFiles(
  () => [contentPath(README_FILES.en), contentPath(README_FILES.vi)],
  (): Record<Lang, SiteContent> => {
    const read = (l: Lang) => parseReadme(readFileSync(contentPath(README_FILES[l]), 'utf8'), l, README_FILES[l])
    const pair = { en: read('en'), vi: read('vi') }
    validatePair(pair.en, pair.vi)
    return pair
  },
)

/**
 * Reads `README.md` + `READMEVN.md` from `$CONTENT_DIR` (default `content`; cwd-relative or absolute) and
 * validates the pair; parsed once and re-read only when the sync rewrites either file (so `next dev` sees a re-sync).
 */
export function loadContent(lang: Lang): SiteContent {
  return loadPair()[lang]
}
