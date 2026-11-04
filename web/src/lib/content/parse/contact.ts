import { trimInline } from '../inline'
import { firstListItems, labelledItem } from '../mdast'
import type { ContactItem } from '../types'

export function parseContact(md: string, file: string): ContactItem[] {
  return firstListItems(md, file, 'contact').map((item) => {
    const { label, rest } = labelledItem(item, file, 'contact')
    return { label, value: trimInline(rest) }
  })
}
