import { statSync } from 'node:fs'

/** `mtime:size` of a file, or `missing`: changes whenever the content sync rewrites (or swaps in) the file. */
function stamp(path: string): string {
  try {
    const s = statSync(path)
    return `${s.mtimeMs}:${s.size}`
  } catch {
    return 'missing'
  }
}

/**
 * Memoises `load()` on the synced files it reads: the cached value is reused until one of `paths()` changes (mtime or
 * size), or the list of paths itself changes (e.g. `$CONTENT_DIR`). While a file is missing (the sync swaps folders,
 * or it was deleted) the last value is kept; with nothing cached yet, `load()` runs and reports the missing file.
 *
 * A plain once-per-process cache is not enough: `next dev` keeps the server module alive across requests, so an
 * `npm run sync` while it runs would never reach the pages (they kept serving the old manifest, i.e. image names that
 * no longer exist). One `stat` per file per call costs nothing next to a render.
 */
export function cachedBySyncedFiles<T>(paths: () => string[], load: () => T): () => T {
  let entry: { paths: string; stamps: string; value: T } | undefined
  return () => {
    const list = paths()
    const pathKey = list.join('\0')
    const stamps = list.map(stamp)
    const stampKey = stamps.join('\0')
    if (entry?.paths === pathKey && (stamps.includes('missing') || entry.stamps === stampKey)) return entry.value
    const value = load()
    entry = { paths: pathKey, stamps: stampKey, value }
    return value
  }
}
