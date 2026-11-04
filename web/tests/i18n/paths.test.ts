import { describe, expect, it } from 'vitest'
import { isLang, otherLang, switchLang } from '@/lib/i18n/paths'

describe('switchLang', () => {
  it('switches a bare language root', () => {
    expect(switchLang('/en', 'vi')).toBe('/vi')
    expect(switchLang('/vi', 'en')).toBe('/en')
  })

  it('keeps the rest of the path', () => {
    expect(switchLang('/vi/projects/caro-app', 'en')).toBe('/en/projects/caro-app')
    expect(switchLang('/en/projects/caro-app', 'vi')).toBe('/vi/projects/caro-app')
  })

  it('keeps a trailing slash and handles a path with no language', () => {
    expect(switchLang('/en/skills/', 'vi')).toBe('/vi/skills/')
    expect(switchLang('/', 'vi')).toBe('/vi')
  })
})

describe('isLang', () => {
  it('accepts only en and vi', () => {
    expect(isLang('en')).toBe(true)
    expect(isLang('vi')).toBe(true)
    expect(isLang('fr')).toBe(false)
  })
})

describe('otherLang', () => {
  it('toggles to the other language', () => {
    expect(otherLang('en')).toBe('vi')
    expect(otherLang('vi')).toBe('en')
  })
})
