import { ContentError } from '../errors'
import { extractProjectBlocks } from '../markers'
import { decodeAssetPath, htmlImages, htmlOf, toMdast } from '../mdast'
import type { PreviewSet } from '../types'

/** Per-project `<img>` screenshots; `src` is the URI-decoded README-relative path. Headings are ignored. */
export function parsePreviews(md: string, file: string): PreviewSet[] {
  return extractProjectBlocks(md, file).map(({ slug, markdown }) => {
    const images = htmlImages(htmlOf(toMdast(markdown))).map(({ tag, attrs }) => {
      if (!attrs.src) throw new ContentError(file, `previews: ${slug}: <img> needs src: ${tag}`)
      return { src: decodeAssetPath(attrs.src, file, `previews: ${slug}`), alt: (attrs.alt ?? '').trim() }
    })
    if (images.length === 0) throw new ContentError(file, `previews: ${slug}: expected <img> screenshots`)
    return { slug, images }
  })
}
