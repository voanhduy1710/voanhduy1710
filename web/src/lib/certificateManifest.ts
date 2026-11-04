import { readFileSync } from 'node:fs'
import { CERTIFICATES_MANIFEST } from './certificates'
import { contentPath } from './contentDir'
import { cachedBySyncedFiles } from './syncedCache'

/** Parses `content/certificates.json` (a JSON array of positive whole numbers). Throws naming the file otherwise. */
export function parseCertificateManifest(text: string): ReadonlySet<number> {
  const value: unknown = JSON.parse(text)
  if (!Array.isArray(value) || !value.every((n) => Number.isInteger(n) && n > 0)) {
    throw new Error(`content/${CERTIFICATES_MANIFEST} must be a JSON array of certificate numbers`)
  }
  return new Set(value as number[])
}

/**
 * The certificate numbers whose PDF the content sync downloaded. Read from `$CONTENT_DIR` (default `content`, like
 * loadContent), and re-read when the sync rewrites it. Missing file = the sync has not run: fails with a hint.
 */
export const loadCertificateNumbers: () => ReadonlySet<number> = cachedBySyncedFiles(
  () => [contentPath(CERTIFICATES_MANIFEST)],
  () => {
    const path = contentPath(CERTIFICATES_MANIFEST)
    let text: string
    try {
      text = readFileSync(path, 'utf8')
    } catch (e) {
      throw new Error(`Cannot read ${path} (written by the content sync: run "npm run sync"): ${(e as Error).message}`)
    }
    return parseCertificateManifest(text)
  },
)
