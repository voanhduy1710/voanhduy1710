import { ContentError } from '../errors'
import { decodeAssetPath, htmlImages, htmlOf, toMdast } from '../mdast'
import type { TechItem } from '../types'

export function parseTechStack(md: string, file: string): TechItem[] {
  const items = htmlImages(htmlOf(toMdast(md))).map(({ tag, attrs }) => {
    if (!attrs.src || !attrs.alt) throw new ContentError(file, `tech-stack: <img> needs src and alt: ${tag}`)
    return { name: attrs.alt.trim(), logo: decodeAssetPath(attrs.src, file, 'tech-stack') }
  })
  if (items.length === 0) throw new ContentError(file, 'tech-stack: expected <img src alt> logos')
  return items
}
