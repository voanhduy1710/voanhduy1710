import { describe, expect, it } from 'vitest'
import { addTab, closeTab, parseTabIds } from '@/components/shell/tabList'

describe('parseTabIds', () => {
  it('reads a JSON list of strings and ignores anything else', () => {
    expect(parseTabIds('["home","project:caro-app"]')).toEqual(['home', 'project:caro-app'])
    expect(parseTabIds('["home",3,null]')).toEqual(['home'])
    expect(parseTabIds('{"a":1}')).toEqual([])
    expect(parseTabIds('not json')).toEqual([])
  })
})

describe('addTab', () => {
  it('appends a new tab and leaves an open one where it is', () => {
    expect(addTab(['home'], 'skills')).toEqual(['home', 'skills'])
    const ids = ['home', 'skills']
    expect(addTab(ids, 'home')).toBe(ids)
  })
})

describe('closeTab', () => {
  const ids = ['home', 'skills', 'cv']

  it('focuses the tab that takes the closed current tab’s place, else the last one', () => {
    expect(closeTab(ids, 'skills', 'skills')).toEqual({ ids: ['home', 'cv'], next: 'cv' })
    expect(closeTab(ids, 'cv', 'cv')).toEqual({ ids: ['home', 'skills'], next: 'skills' })
  })

  it('does not navigate when a background tab or the only tab is closed', () => {
    expect(closeTab(ids, 'home', 'cv')).toEqual({ ids: ['skills', 'cv'] })
    expect(closeTab(['home'], 'home', 'home')).toEqual({ ids: [] })
  })

  it('ignores an id that is not open', () => {
    expect(closeTab(ids, 'contact', 'home')).toEqual({ ids })
  })
})
