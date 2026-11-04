// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { elementInEditor, visibleEditor } from '@/components/shell/editorPane'

/** jsdom has no layout: a hidden pane reports no client rects, like a display:none subtree in a browser. */
function editor(visible: boolean, sectionId: string) {
  const main = document.createElement('main')
  main.id = 'editor'
  main.getClientRects = () => (visible ? ([{}] as unknown as DOMRectList) : ([] as unknown as DOMRectList))
  const s = document.createElement('section')
  s.id = sectionId
  main.append(s)
  document.body.append(main)
  return main
}

afterEach(() => void (document.body.innerHTML = ''))

describe('visibleEditor', () => {
  it('returns the visible pane whether the hidden one (previous language) comes first or last', () => {
    const hidden = editor(false, 'skills')
    const shown = editor(true, 'skills')
    expect(visibleEditor()).toBe(shown)
    document.body.append(hidden) // now the hidden one is last
    expect(visibleEditor()).toBe(shown)
  })
  it('is undefined with no editor or only hidden ones', () => {
    expect(visibleEditor()).toBeUndefined()
    editor(false, 'skills')
    expect(visibleEditor()).toBeUndefined()
  })
})

describe('elementInEditor', () => {
  it('finds the element inside the visible pane, not the same id in the hidden one', () => {
    const hidden = editor(false, 'skills')
    const shown = editor(true, 'skills')
    const el = elementInEditor('skills')
    expect(el).toBe(shown.querySelector('section'))
    expect(el).not.toBe(hidden.querySelector('section'))
    expect(elementInEditor('nope')).toBeNull()
  })
})
