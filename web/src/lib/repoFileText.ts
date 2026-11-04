import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RepoFile } from './repoFiles'

/**
 * One reader per allow-listed file, each with a literal path, so nothing else can be read. The paths are the `path`
 * of each entry in REPO_FILES (checked by tests/repoFiles.test.ts). The pages are prerendered at build time, so the
 * reads are kept out of the server bundle's file tracing (`turbopackIgnore`); otherwise Turbopack traces the whole
 * project into the deployment.
 */
const READERS: Record<string, () => string> = {
  gitignore: () => readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), 'content', 'repo-files', 'gitignore'), 'utf8'),
  vercelignore: () => readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), '.vercelignore'), 'utf8'),
  'next.config.ts': () => readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), 'next.config.ts'), 'utf8'),
  'package.json': () => readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), 'package.json'), 'utf8'),
  'tsconfig.json': () => readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), 'tsconfig.json'), 'utf8'),
}

/** Slugs that have a reader (tests compare this with REPO_FILES). */
export const READER_SLUGS = Object.keys(READERS)

/** The file's text as of the build, with CRLF line endings turned into LF. Throws naming the file if it is missing. */
export function readRepoFile(file: RepoFile): string {
  const read = READERS[file.slug]
  if (!read) throw new Error(`${file.name} is not an allow-listed repo file`)
  try {
    return read().replace(/\r\n?/g, '\n')
  } catch (e) {
    const hint = file.slug === 'gitignore' ? ' (copied by the content sync: run "npm run sync")' : ''
    throw new Error(`Cannot read ${file.name} from ${file.path}${hint}: ${(e as Error).message}`)
  }
}
