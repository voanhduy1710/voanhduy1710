/** The site's Supabase project (curriculum-vitae). Not a secret: the secret key is what grants access. */
export const DEFAULT_SUPABASE_URL = 'https://sudfxyhjksqjmarwcevp.supabase.co'

/** `$SUPABASE_URL` (trailing slashes trimmed), else the site's project. */
export function supabaseBaseUrl(): string {
  return (process.env.SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL).replace(/\/+$/, '')
}
