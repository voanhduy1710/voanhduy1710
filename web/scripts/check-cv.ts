/**
 * The one-A4-page CV rule: prints web/public/cv/CV_EN.html and CV_VN.html (the CV source files, design in cv.css) to
 * PDF with headless Chrome (exactly as export_cv.ps1 does) and fails, naming the file, when either PDF has more than
 * one page. A real print, not an estimate: the browser's own layout, fonts and page breaks decide. No build or server
 * is needed: the files are printed straight from disk.
 *
 * CLI, from `web/`:
 *   npm run check:cv                          print the two HTML files
 *   npm run check:cv -- --out <dir>           keep the printed PDFs (cv-en.pdf, cv-vi.pdf) in <dir>
 *   npm run check:cv -- --base http://localhost:3010     print the website's /en/cv and /vi/cv instead (a running server)
 *   npm run check:cv -- --pdf <file>...       only count the pages of existing PDFs
 * Exit code 0 = every CV is one page; 1 = a CV overflows (or could not be printed).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { LANGS } from '../src/lib/content/types'
import { CV_HTML_FILES } from '../src/lib/cv/html'
import { pdfPageCount } from '../src/lib/cv/pdfPages'

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BROWSER_TIMEOUT_MS = 60_000

const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const green = (s: string) => `\x1b[32m${s}\x1b[0m`

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function findBrowser(): string | undefined {
  const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  return [
    process.env.CHROME_PATH,
    join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((p): p is string => !!p && existsSync(p))
}

/** Prints `url` to `pdfPath` with the same flags as export_cv.ps1. */
function printToPdf(browser: string, url: string, pdfPath: string, profileDir: string): void {
  const res = spawnSync(
    browser,
    ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${profileDir}`, `--print-to-pdf=${pdfPath}`, url],
    { timeout: BROWSER_TIMEOUT_MS, stdio: 'ignore' },
  )
  if (res.error) throw new Error(`the browser failed on ${url}: ${res.error.message}`)
  if (!existsSync(pdfPath)) throw new Error(`the browser wrote no PDF for ${url}`)
}

/** `--pdf a.pdf b.pdf`: prints "<pages>\t<file>" per file; fails when one has more than one page. */
function countOnly(files: string[]): number {
  let ok = true
  for (const f of files) {
    const pages = pdfPageCount(readFileSync(f))
    console.log(`${pages}\t${f}`)
    if (pages !== 1) ok = false
  }
  return ok ? 0 : 1
}

function main(): number {
  const pdfIndex = process.argv.indexOf('--pdf')
  if (pdfIndex >= 0) return countOnly(process.argv.slice(pdfIndex + 1))

  const browser = findBrowser()
  if (!browser) throw new Error('neither Google Chrome nor Microsoft Edge was found (set CHROME_PATH)')
  const base = arg('--base')?.replace(/\/$/, '')
  const work = mkdtempSync(join(tmpdir(), 'check-cv-'))
  const outDir = arg('--out') ? resolve(arg('--out')!) : work
  mkdirSync(outDir, { recursive: true })
  try {
    console.log(`CV one-A4-page check: ${base ? `${base}/{en,vi}/cv` : 'web/public/cv/CV_EN.html + CV_VN.html'} (${browser.split(/[\\/]/).pop()})`)
    const overflow: string[] = []
    for (const lang of LANGS) {
      const file = CV_HTML_FILES[lang]
      const url = base ? `${base}/${lang}/cv` : pathToFileURL(join(WEB, file)).href
      const pdf = join(outDir, `cv-${lang}.pdf`)
      rmSync(pdf, { force: true })
      printToPdf(browser, url, pdf, join(work, 'profile'))
      const pages = pdfPageCount(readFileSync(pdf))
      if (pages === 1) {
        console.log(green(`  ✓ ${lang}: 1 A4 page`))
      } else {
        overflow.push(lang)
        console.log(red(`  ✗ ${lang}: ${pages} pages — does not fit one A4 page: shorten web/${file}`))
      }
    }
    if (outDir !== work) console.log(`  PDFs kept in ${outDir}`)
    if (overflow.length > 0) {
      console.log(red(`CV rule broken: the CV must be exactly one A4 page (${overflow.join(', ')} overflow).`))
      return 1
    }
    console.log(green('CV rule OK: both CVs fit one A4 page.'))
    return 0
  } finally {
    rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

try {
  process.exit(main())
} catch (e) {
  console.error(red(`check:cv failed: ${(e as Error).message}`))
  process.exit(1)
}
