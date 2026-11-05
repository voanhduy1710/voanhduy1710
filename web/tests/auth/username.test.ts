import { describe, expect, it } from 'vitest'
import { accountName, loginEmail, MIN_PASSWORD_LENGTH, OWNER_EMAIL, OWNER_USERNAME } from '@/lib/auth/username'

describe('loginEmail (username -> email)', () => {
  it('maps the owner username, in any case and with spaces, to the owner email', () => {
    expect(loginEmail('voanhduy1710')).toBe(OWNER_EMAIL)
    expect(loginEmail('  VoAnhDuy1710 ')).toBe(OWNER_EMAIL)
    expect(OWNER_EMAIL).toBe('voanhduy1710@gmail.com')
  })
  it('keeps an email as typed (lower-cased, trimmed)', () => {
    expect(loginEmail(' VoAnhDuy1710@Gmail.com ')).toBe('voanhduy1710@gmail.com')
    expect(loginEmail('someone@example.com')).toBe('someone@example.com')
  })
  it('rejects empty input, other usernames and malformed emails', () => {
    for (const bad of ['', '   ', 'admin', 'voanhduy', 'a@b', '@x.com', 'a b@c.de']) expect(loginEmail(bad)).toBeNull()
  })
})

describe('accountName', () => {
  it('names the owner by username and others by email', () => {
    expect(accountName(OWNER_EMAIL)).toBe(OWNER_USERNAME)
    expect(accountName('VOANHDUY1710@GMAIL.COM')).toBe('voanhduy1710')
    expect(accountName('x@y.co')).toBe('x@y.co')
    expect(accountName(undefined)).toBe('')
  })
  it('requires new passwords of at least 12 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12)
  })
})
