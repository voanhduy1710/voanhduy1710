/**
 * The site has one account: the owner's (Supabase Auth, created by hand; there is no sign-up). Supabase signs in by
 * email, so the login dialog also accepts the owner's username and maps it to that email.
 */
export const OWNER_USERNAME = 'voanhduy1710'
export const OWNER_EMAIL = 'voanhduy1710@gmail.com'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The email to sign in with: `voanhduy1710` (any case) -> the owner's email; an email as typed (lower-cased); else null. */
export function loginEmail(input: string): string | null {
  const v = input.trim().toLowerCase()
  if (!v) return null
  if (v === OWNER_USERNAME) return OWNER_EMAIL
  return EMAIL.test(v) ? v : null
}

/** How the account menu names a signed-in user: the owner as `voanhduy1710`, anyone else by email. */
export function accountName(email: string | undefined): string {
  if (!email) return ''
  return email.toLowerCase() === OWNER_EMAIL ? OWNER_USERNAME : email
}

/** Rule for a new password (the change-password dialog). */
export const MIN_PASSWORD_LENGTH = 12
