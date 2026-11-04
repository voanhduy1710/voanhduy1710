import { inlineText } from '../inline'
import { firstListItems, labelledItem } from '../mdast'
import type { LanguageItem } from '../types'

export function parseLanguages(md: string, file: string): LanguageItem[] {
  return firstListItems(md, file, 'languages').map((item) => {
    const { label, rest } = labelledItem(item, file, 'languages')
    return { name: label, level: inlineText(rest).trim() }
  })
}
