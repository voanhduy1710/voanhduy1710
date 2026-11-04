import { join, resolve } from 'node:path'

/**
 * A path inside the synced content folder: `$CONTENT_DIR` (cwd-relative or absolute; used by tests) or, by default,
 * `content/` in the working directory. The default is spelled out as `content` so the build's file tracing stays
 * scoped to that folder; the override is excluded from tracing (`turbopackIgnore`).
 */
export function contentPath(...parts: string[]): string {
  const override = process.env.CONTENT_DIR
  return override
    ? resolve(/*turbopackIgnore: true*/ process.cwd(), override, ...parts)
    : join(process.cwd(), 'content', ...parts)
}
