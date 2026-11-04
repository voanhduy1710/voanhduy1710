import { describe, expect, it } from 'vitest'
import { languageAlternates } from '@/lib/i18n/paths'
import { langCookie, pickLang, topAcceptLanguage } from '@/lib/i18n/pickLang'

describe('pickLang', () => {
  it('a valid cookie wins over country and browser language', () => {
    expect(pickLang({ cookie: 'en', country: 'VN', acceptLanguage: 'vi' })).toBe('en')
    expect(pickLang({ cookie: 'vi', country: 'US', acceptLanguage: 'en' })).toBe('vi')
  })
  it('an invalid cookie is ignored', () => {
    expect(pickLang({ cookie: 'fr', country: 'VN' })).toBe('vi')
    expect(pickLang({ cookie: '', acceptLanguage: 'en' })).toBe('en')
  })
  it('Vietnam goes to vi', () => {
    expect(pickLang({ country: 'VN' })).toBe('vi')
    expect(pickLang({ country: 'vn', acceptLanguage: 'en-US' })).toBe('vi')
    expect(pickLang({ country: 'US' })).toBe('en')
  })
  it('follows the highest-q browser language', () => {
    expect(pickLang({ acceptLanguage: 'vi-VN,vi;q=0.9' })).toBe('vi')
    expect(pickLang({ acceptLanguage: 'vi' })).toBe('vi')
    expect(pickLang({ acceptLanguage: 'en-US,vi;q=0.9' })).toBe('en')
    expect(pickLang({ acceptLanguage: 'en;q=0.5, vi;q=0.8' })).toBe('vi')
    expect(pickLang({ acceptLanguage: 'fr, vi;q=0.5' })).toBe('en')
  })
  it('garbage or missing input is English', () => {
    expect(pickLang({})).toBe('en')
    expect(pickLang({ cookie: null, country: null, acceptLanguage: null })).toBe('en')
    expect(pickLang({ acceptLanguage: ';;;,,,q=' })).toBe('en')
    expect(pickLang({ acceptLanguage: '*' })).toBe('en')
    expect(pickLang({ acceptLanguage: 'vi;q=0' })).toBe('en')
  })
})

describe('topAcceptLanguage', () => {
  it('returns the primary subtag of the best entry; the first wins a tie', () => {
    expect(topAcceptLanguage('vi-VN')).toBe('vi')
    expect(topAcceptLanguage('en-US, vi')).toBe('en')
    expect(topAcceptLanguage(undefined)).toBeUndefined()
  })
})

describe('langCookie', () => {
  it('is a year-long, site-wide Lax cookie; Secure only on https', () => {
    expect(langCookie('vi', false)).toBe('lang=vi; Path=/; Max-Age=31536000; SameSite=Lax')
    expect(langCookie('en', true)).toBe('lang=en; Path=/; Max-Age=31536000; SameSite=Lax; Secure')
  })
})

describe('languageAlternates', () => {
  it('home page: both languages and x-default = /', () => {
    expect(languageAlternates('')).toEqual({ languages: { en: '/en', vi: '/vi', 'x-default': '/' } })
  })

  it('deep pages: only en + vi, no x-default', () => {
    expect(languageAlternates('/projects/caro-app')).toEqual({
      languages: { en: '/en/projects/caro-app', vi: '/vi/projects/caro-app' },
    })
    expect(languageAlternates('/cv').languages).not.toHaveProperty('x-default')
  })
})
