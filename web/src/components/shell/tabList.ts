/** Pure tab-list operations behind `useOpenTabs` (ids are nav page ids). */

export function parseTabIds(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** Appends `id` unless it is already open (the list is returned unchanged then). */
export function addTab(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id]
}

/**
 * Removes `id`. When it was the current tab, `next` is the tab to focus: the one that took its place,
 * else the new last one; undefined when no tab is left or another tab was current.
 */
export function closeTab(ids: string[], id: string, currentId: string | undefined): { ids: string[]; next?: string } {
  const index = ids.indexOf(id)
  if (index === -1) return { ids }
  const rest = ids.filter((x) => x !== id)
  if (id !== currentId || rest.length === 0) return { ids: rest }
  return { ids: rest, next: rest[Math.min(index, rest.length - 1)] }
}
