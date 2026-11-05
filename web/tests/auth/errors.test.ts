import { describe, expect, it } from 'vitest'
import { authErrorKind } from '@/lib/auth/errors'

describe('authErrorKind', () => {
  it('maps Supabase Auth error codes', () => {
    expect(authErrorKind({ name: 'AuthApiError', code: 'invalid_credentials', status: 400 })).toBe('invalid')
    expect(authErrorKind({ name: 'AuthApiError', code: 'over_request_rate_limit', status: 429 })).toBe('rateLimit')
    expect(authErrorKind({ name: 'AuthApiError', status: 429 })).toBe('rateLimit')
    expect(authErrorKind({ name: 'AuthApiError', code: 'same_password', status: 422 })).toBe('samePassword')
    expect(authErrorKind({ name: 'AuthWeakPasswordError', code: 'weak_password', status: 422 })).toBe('weakPassword')
    expect(authErrorKind({ name: 'AuthApiError', code: 'reauthentication_needed', status: 400 })).toBe('reauth')
    expect(authErrorKind({ name: 'AuthApiError', code: 'email_not_confirmed', status: 400 })).toBe('unconfirmed')
  })
  it('treats fetch failures as network errors and anything else as generic', () => {
    expect(authErrorKind({ name: 'AuthRetryableFetchError', status: 0 })).toBe('network')
    expect(authErrorKind(new TypeError('Failed to fetch'))).toBe('network')
    expect(authErrorKind(new Error('boom'))).toBe('generic')
    expect(authErrorKind(null)).toBe('generic')
  })
})
