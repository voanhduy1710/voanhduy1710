// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountAuthItems } from '@/components/shell/AccountAuth'
import { accountMenuItems } from '@/components/shell/accountMenu'
import { CvToolbar } from '@/components/cv/CvToolbar'
import type { AuthState } from '@/lib/auth/session'

const auth = vi.hoisted(() => ({ state: { status: 'signedOut' } as AuthState }))
vi.mock('@/lib/auth/session', () => ({ useAuth: () => auth.state, signOut: vi.fn(async () => {}), connect: vi.fn(async () => null) }))
vi.mock('@/lib/auth/client', () => ({ authConfigured: () => true, hasStoredSession: () => false }))

afterEach(cleanup)

describe('accountMenuItems', () => {
  it('signed out: Log in only (no sign-up, no forgot password)', () => {
    expect(accountMenuItems({ status: 'signedOut' }, true)).toEqual(['login'])
  })
  it('signed in: account, Change password, Log out', () => {
    expect(accountMenuItems({ status: 'signedIn', userId: 'u', email: 'voanhduy1710@gmail.com' }, true)).toEqual([
      'account',
      'changePassword',
      'logout',
    ])
  })
  it('nothing while unknown or when login is not configured', () => {
    expect(accountMenuItems({ status: 'unknown' }, true)).toEqual([])
    expect(accountMenuItems({ status: 'signedIn', userId: 'u', email: 'x@y.co' }, false)).toEqual([])
  })
})

describe('AccountAuthItems', () => {
  const labels = { login: 'Log in', logout: 'Log out', changePassword: 'Change password', account: 'Signed in as' }
  const renderItems = () => render(<AccountAuthItems labels={labels} itemClass="" close={() => {}} openDialog={() => {}} />)

  it('signed out shows Log in and no account items', () => {
    auth.state = { status: 'signedOut' }
    renderItems()
    expect(screen.getByRole('menuitem', { name: 'Log in' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Log out' })).toBeNull()
    expect(screen.queryByText(/sign up|register|forgot/i)).toBeNull()
  })
  it('signed in shows the username, Change password and Log out', () => {
    auth.state = { status: 'signedIn', userId: 'u', email: 'voanhduy1710@gmail.com' }
    renderItems()
    expect(screen.getByText('voanhduy1710')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Change password' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Log in' })).toBeNull()
  })
})

describe('CvToolbar colour control', () => {
  const cvHref = { en: '/a.pdf', vi: '/b.pdf' }
  it('is hidden when signed out', () => {
    auth.state = { status: 'signedOut' }
    render(<CvToolbar lang="en" cvHref={cvHref} />)
    expect(screen.queryByRole('button', { name: /Colour/ })).toBeNull()
  })
  it('is shown when signed in (lazy chunk)', async () => {
    auth.state = { status: 'signedIn', userId: 'u', email: 'voanhduy1710@gmail.com' }
    render(<CvToolbar lang="en" cvHref={cvHref} />)
    expect(await screen.findByRole('button', { name: /Colour/ })).toBeTruthy()
  })
})
