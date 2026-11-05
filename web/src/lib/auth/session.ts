import { useSyncExternalStore } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clearAccent } from '@/lib/cv/accentStore'
import { authConfigured, hasStoredSession, loadClient } from './client'

/**
 * Client-side owner session, shared by the account menu and the CV colour control. Pages stay static: nothing here
 * runs on the server. Without a stored session the state is `signedOut` straight away and supabase-js is not loaded.
 */
export type AuthState =
  | { status: 'unknown' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; userId: string; email: string }

const UNKNOWN: AuthState = { status: 'unknown' }
const SIGNED_OUT: AuthState = { status: 'signedOut' }

let state: AuthState = UNKNOWN
let started = false
let listening = false
const listeners = new Set<() => void>()

function setState(next: AuthState) {
  const same =
    next.status === state.status &&
    (next.status !== 'signedIn' || (state.status === 'signedIn' && next.userId === state.userId && next.email === state.email))
  if (same) return
  state = next
  for (const l of listeners) l()
}

/** Loads the client (once) and follows its auth events. Resolves to null when login is not configured or fails to load. */
export async function connect(): Promise<SupabaseClient | null> {
  let client: SupabaseClient | null = null
  try {
    client = await loadClient()
  } catch {
    client = null
  }
  if (!client) {
    if (state.status === 'unknown') setState(SIGNED_OUT)
    return null
  }
  if (!listening) {
    listening = true
    // Fires INITIAL_SESSION right away with the stored session (if any). No awaits inside the callback (supabase-js rule).
    client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      setState(user ? { status: 'signedIn', userId: user.id, email: user.email ?? '' } : SIGNED_OUT)
      if (!user) clearAccent()
    })
  }
  return client
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  if (authConfigured() && hasStoredSession()) void connect()
  else setState(SIGNED_OUT)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  start()
  return () => {
    listeners.delete(listener)
  }
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => UNKNOWN,
  )
}

/** Email + password sign-in (no sign-up anywhere on the site). Throws the AuthError on failure. */
export async function signIn(email: string, password: string): Promise<void> {
  const client = await connect()
  if (!client) throw Object.assign(new Error('login unavailable'), { name: 'AuthRetryableFetchError' })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  clearAccent()
  const client = await connect()
  // Default scope 'global': also revokes the refresh tokens of the account's other sessions.
  if (client) await client.auth.signOut()
  setState(SIGNED_OUT)
}

export async function changePassword(password: string): Promise<void> {
  const client = await connect()
  if (!client) throw Object.assign(new Error('login unavailable'), { name: 'AuthRetryableFetchError' })
  const { error } = await client.auth.updateUser({ password })
  if (error) throw error
}
