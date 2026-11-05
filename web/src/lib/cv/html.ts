import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, serialize } from 'parse5'
import type { Lang } from '../content/types'

/**
 * The CV of each language is a hand-edited HTML file in `web/public/cv/` (design in `cv.css` next to it). The website
 * shows the content of its `<main class="cv">` sheet on /{lang}/cv; export_cv.ps1 prints the files themselves to the
 * PDFs. Both files are also served as-is at /cv/CV_EN.html and /cv/CV_VN.html.
 */
export const CV_HTML_FILES: Record<Lang, string> = {
  en: 'public/cv/CV_EN.html',
  vi: 'public/cv/CV_VN.html',
}

export interface CvHtml {
  lang: Lang
  /** text of the <h1> (the name) */
  name: string
  /** inner HTML of <main class="cv"> */
  body: string
}

interface Node {
  nodeName: string
  value?: string
  attrs?: { name: string; value: string }[]
  childNodes?: Node[]
}

const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base'])

function findSheet(n: Node): Node | undefined {
  if (n.nodeName === 'main' && (n.attrs?.find((a) => a.name === 'class')?.value ?? '').split(/\s+/).includes('cv')) return n
  for (const c of n.childNodes ?? []) {
    const hit = findSheet(c)
    if (hit) return hit
  }
  return undefined
}

/** Defensive clean-up of the sheet before it goes into the page: no scripts / embeds, no on* handlers, no javascript: links. */
function clean(n: Node): void {
  if (n.childNodes) n.childNodes = n.childNodes.filter((c) => !DROP.has(c.nodeName) && c.nodeName !== '#comment')
  if (n.attrs) {
    n.attrs = n.attrs.filter(
      (a) => !/^on/i.test(a.name) && !((a.name === 'href' || a.name === 'src') && /^\s*javascript:/i.test(a.value)),
    )
  }
  for (const c of n.childNodes ?? []) clean(c)
}

function text(n: Node): string {
  if (n.nodeName === '#text') return n.value ?? ''
  return (n.childNodes ?? []).map(text).join('')
}

function first(n: Node, name: string): Node | undefined {
  for (const c of n.childNodes ?? []) {
    if (c.nodeName === name) return c
    const hit = first(c, name)
    if (hit) return hit
  }
  return undefined
}

export function parseCvHtml(html: string, lang: Lang, file = CV_HTML_FILES[lang]): CvHtml {
  const sheet = findSheet(parse(html) as unknown as Node)
  if (!sheet) throw new Error(`${file}: no <main class="cv"> element (the A4 sheet) found`)
  clean(sheet)
  const h1 = first(sheet, 'h1')
  return {
    lang,
    name: h1 ? text(h1).replace(/\s+/g, ' ').trim() : '',
    body: serialize(sheet as never).trim(),
  }
}

/** The CV for `lang`, read from disk on every call (so `next dev` shows an edit on reload; pages are static in a build). */
export function loadCvHtml(lang: Lang): CvHtml {
  const file = CV_HTML_FILES[lang]
  return parseCvHtml(readFileSync(join(process.cwd(), file), 'utf8'), lang, file)
}
