import { describe, expect, it } from 'vitest'
import {
  clampSidebarWidth,
  keyedSidebarWidth,
  maxSidebarWidth,
  SIDEBAR_WIDTH_BOOT,
} from '@/components/shell/sidebarWidth'

describe('sidebar width', () => {
  it('is at most half the window and never above 560px, never below 170px', () => {
    expect(maxSidebarWidth(1920)).toBe(560)
    expect(maxSidebarWidth(1000)).toBe(500)
    expect(maxSidebarWidth(300)).toBe(170)
    expect(clampSidebarWidth(100, 1920)).toBe(170)
    expect(clampSidebarWidth(900, 1920)).toBe(560)
    expect(clampSidebarWidth(700, 1000)).toBe(500)
    expect(clampSidebarWidth(300.6, 1000)).toBe(301)
  })

  it('moves 16px per arrow key, within the limits; other keys do nothing', () => {
    expect(keyedSidebarWidth('ArrowRight', 300, 1920)).toBe(316)
    expect(keyedSidebarWidth('ArrowLeft', 300, 1920)).toBe(284)
    expect(keyedSidebarWidth('ArrowLeft', 175, 1920)).toBe(170)
    expect(keyedSidebarWidth('ArrowRight', 555, 1920)).toBe(560)
    expect(keyedSidebarWidth('Enter', 300, 1920)).toBeUndefined()
  })

  it('the pre-paint script applies a stored width to <html> and ignores garbage', () => {
    const run = (stored: string | null) => {
      const props: Record<string, string> = {}
      const localStorage = { getItem: () => stored }
      const document = { documentElement: { style: { setProperty: (k: string, v: string) => (props[k] = v) } } }
      new Function('localStorage', 'document', SIDEBAR_WIDTH_BOOT)(localStorage, document)
      return props
    }
    expect(run('420')).toEqual({ '--sidebar-w': '420px' })
    expect(run('x;alert(1)')).toEqual({})
    expect(run('42px')).toEqual({})
    expect(run('99999')).toEqual({})
    expect(run(null)).toEqual({})
  })
})
