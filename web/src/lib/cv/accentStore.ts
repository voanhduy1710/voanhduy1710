import type { SupabaseClient } from '@supabase/supabase-js'
import { isHexColor } from './hex'

/**
 * The signed-in owner's CV accent: applied as `--cv-accent` on <html> (an inline style, so it beats the Pine default
 * `:root { --cv-accent }` in public/cv/cv.css, from which every CV tint is derived), cached in localStorage for an
 * instant apply on the next visit, and saved per user in `public.cv_preferences` (RLS: own row only). Signing out removes all three traces from this browser, so the public CV is always the default.
 */

export const ACCENT_CACHE_KEY = 'cv-accent'
export const ACCENT_VAR = '--cv-accent'

export function applyAccent(hex: string | null): void {
  const style = document.documentElement.style
  if (hex && isHexColor(hex)) style.setProperty(ACCENT_VAR, hex)
  else style.removeProperty(ACCENT_VAR)
}

export function cachedAccent(): string | null {
  try {
    const v = window.localStorage.getItem(ACCENT_CACHE_KEY)
    return isHexColor(v) ? v : null
  } catch {
    return null
  }
}

export function cacheAccent(hex: string | null): void {
  try {
    if (hex && isHexColor(hex)) window.localStorage.setItem(ACCENT_CACHE_KEY, hex)
    else window.localStorage.removeItem(ACCENT_CACHE_KEY)
  } catch {
    // storage blocked: the colour still applies for this page view
  }
}

/** Forget the owner's colour in this browser (sign-out). */
export function clearAccent(): void {
  cacheAccent(null)
  applyAccent(null)
}

/** The saved colour of this user, or null (no row yet). Throws on a request error. */
export async function fetchAccent(client: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await client.from('cv_preferences').select('accent').eq('user_id', userId).maybeSingle()
  if (error) throw error
  const accent = (data as { accent?: unknown } | null)?.accent
  return isHexColor(accent) ? accent.toLowerCase() : null
}

export async function saveAccent(client: SupabaseClient, userId: string, hex: string): Promise<void> {
  if (!isHexColor(hex)) throw new Error('invalid colour')
  const { error } = await client
    .from('cv_preferences')
    .upsert({ user_id: userId, accent: hex.toLowerCase(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw error
}
