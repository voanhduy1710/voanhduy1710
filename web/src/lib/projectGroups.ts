/**
 * Splits the projects by README group. Groups are told apart by order, so the same rule works in both languages:
 * the second group (today "Data Analytics & Business Intelligence") is the analytics group, every other group
 * (today only "Full-Stack Applications & Production Systems") is "My works". No imports, so the content sync, the nav
 * model (client) and the pages (server) can all use it.
 */
export function splitGroups<P extends { group?: string }>(projects: P[]): { works: P[]; analytics: P[] } {
  const groups = [...new Set(projects.map((p) => p.group ?? ''))]
  const analytics = groups.length > 1 ? groups[1] : undefined
  return {
    works: projects.filter((p) => (p.group ?? '') !== analytics),
    analytics: projects.filter((p) => analytics !== undefined && p.group === analytics),
  }
}
