import { inflateSync } from 'node:zlib'

/** A page object (`/Type /Page`), not the page tree (`/Type /Pages`). */
const PAGE_OBJECT = /\/Type\s*\/Page(?![A-Za-z])/g
/** A compressed object stream: `<< ... /Type /ObjStm ... >> stream ... endstream`. */
const OBJECT_STREAM = /<<((?:(?!>>\s*stream)[\s\S])*?\/Type\s*\/ObjStm[\s\S]*?)>>\s*stream\r?\n/g

function count(text: string): number {
  return text.match(PAGE_OBJECT)?.length ?? 0
}

/**
 * Number of pages in a PDF: its page objects, including those inside Flate-compressed object streams (Word/Acrobat
 * PDFs such as the original CV use them; Chrome's print-to-PDF writes them plainly). No PDF library needed. Used by
 * `npm run check:cv` and export_cv.ps1 to enforce the one-A4-page CV rule.
 */
export function pdfPageCount(pdf: Buffer): number {
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('not a PDF file')
  const text = pdf.toString('latin1')
  let pages = count(text)
  for (const m of text.matchAll(OBJECT_STREAM)) {
    const dict = m[1]
    if (!/\/FlateDecode/.test(dict)) continue
    const start = (m.index ?? 0) + m[0].length
    const end = text.indexOf('endstream', start)
    if (end < 0) continue
    try {
      pages += count(inflateSync(pdf.subarray(start, end)).toString('latin1'))
    } catch {
      // A damaged stream: its pages cannot be counted, the plain ones still are.
    }
  }
  return pages
}
