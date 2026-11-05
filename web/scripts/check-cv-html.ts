/**
 * CV drift check: web/public/cv/CV_EN.html and CV_VN.html must keep the same structure (sections, jobs, bullets per
 * job, projects, skills rows, certifications, degrees, languages) and the same links (website pages may differ only
 * in /en/ vs /vi/). Prints every difference.
 *
 * CLI, from `web/`:
 *   npm run check:cv-html                 warn only (exit 0)
 *   npm run check:cv-html -- --strict     exit 1 when the files drift apart
 *   npm run check:cv-html -- --en <file> --vn <file>     compare other files
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareCvHtml } from '../src/lib/cv/htmlDrift'

const CV_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'cv')

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const strict = process.argv.includes('--strict')
const enPath = resolve(arg('--en') ?? resolve(CV_DIR, 'CV_EN.html'))
const vnPath = resolve(arg('--vn') ?? resolve(CV_DIR, 'CV_VN.html'))

const diffs = compareCvHtml(readFileSync(enPath, 'utf8'), readFileSync(vnPath, 'utf8'))
if (diffs.length === 0) {
  console.log('\x1b[32mCV drift check: CV_EN.html and CV_VN.html match (structure + links).\x1b[0m')
} else {
  const colour = strict ? '\x1b[31m' : '\x1b[33m'
  console.log(`${colour}CV drift check: CV_EN.html and CV_VN.html differ in ${diffs.length} place(s):\x1b[0m`)
  for (const d of diffs) console.log(`  - ${d}`)
  if (strict) process.exit(1)
  console.log('(warning only; run with --strict to fail)')
}
