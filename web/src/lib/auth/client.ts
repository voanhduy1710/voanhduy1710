import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser-only Supabase client for the owner login (publishable key: safe in the browser; data is guarded by RLS).
 * `@supabase/supabase-js` is a dynamic import, so it is a separate chunk that public visitors only download when they
 * open the account menu or arrive with a stored session.
 */

/** localStorage key of the persisted Supabase session (set explicitly so `hasStoredSession` can check it cheaply). */
export const AUTH_STORAGE_KEY = 'sb-portfolio-auth'

// Literal process.env.NEXT_PUBLIC_* reads: Next inlines them into the client bundle at build time.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

/** Login is offered only when the build has the public Supabase URL and key. */
export function authConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY)
}

let clientPromise: Promise<SupabaseClient | null> | null = null

export function loadClient(): Promise<SupabaseClient | null> {
  if (typeof window === 'undefined' || !SUPABASE_URL || !SUPABASE_KEY) return Promise.resolve(null)
  clientPromise ??= import('@supabase/supabase-js').then(
    ({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_STORAGE_KEY },
      }),
    (err: unknown) => {
      clientPromise = null // let a later call retry (e.g. after a network error)
      throw err
    },
  )
  return clientPromise
}

/** Whether this browser has a saved session, without loading supabase-js. */
export function hasStoredSession(): boolean {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) !== null
  } catch {
    return false
  }
}
