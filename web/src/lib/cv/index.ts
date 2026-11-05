import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Lang } from '../content/types'
import { cachedBySyncedFiles } from '../syncedCache'
import { parseCvPair } from './parse'
import type { CvModel } from './types'

export { CV_FILES, parseCv, parseCvPair, validateCvPair } from './parse'
export type * from './types'

/** `web/public/cv/<name>`: part of the website folder, so no content sync is needed (spelled out for file tracing). */
const cvPath = (name: string) => join(process.cwd(), 'public', 'cv', name)

const loadPair = cachedBySyncedFiles(
  () => [cvPath('cv.en.yaml'), cvPath('cv.vi.yaml')],
  (): Record<Lang, CvModel> =>
    parseCvPair({ en: readFileSync(cvPath('cv.en.yaml'), 'utf8'), vi: readFileSync(cvPath('cv.vi.yaml'), 'utf8') }),
)

/**
 * The CV for `lang`, from `web/public/cv/cv.{en,vi}.yaml`. Both files are parsed, validated and checked against each
 * other; re-read only when one changes on disk (so `next dev` shows an edit on reload). A bad file throws, which
 * fails `next build` (and so export_cv.ps1 / deploy) with the file, field path and line.
 */
export function loadCv(lang: Lang): CvModel {
  return loadPair()[lang]
}
