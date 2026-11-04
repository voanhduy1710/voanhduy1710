/**
 * The visible editor pane. Next keeps the previous language's layout in the DOM, hidden (for back navigation), so
 * there can be two `#editor` elements; the hidden one has no layout boxes. Everything that looks up the pane (section
 * scroll, scroll-spy, restore) uses this.
 */
export function visibleEditor(doc: Document = document): HTMLElement | undefined {
  const all = [...doc.querySelectorAll<HTMLElement>('[id="editor"]')]
  return all.find((el) => el.getClientRects().length > 0)
}

/** An element by id inside the visible pane (hidden copies of the same id are skipped). */
export function elementInEditor(id: string, doc: Document = document): HTMLElement | null {
  return visibleEditor(doc)?.querySelector<HTMLElement>(`[id="${id}"]`) ?? null
}
