/** What went wrong with a sign-in or password change, for a short message in the dialog (no raw server text shown). */
export type AuthErrorKind = 'invalid' | 'rateLimit' | 'network' | 'samePassword' | 'weakPassword' | 'reauth' | 'unconfirmed' | 'generic'

/** Maps a supabase-js AuthError (code / status / name) to a message kind. */
export function authErrorKind(err: unknown): AuthErrorKind {
  if (!err || typeof err !== 'object') return 'generic'
  const { code, status, name } = err as { code?: unknown; status?: unknown; name?: unknown }
  if (name === 'AuthRetryableFetchError' || (err instanceof TypeError && /fetch/i.test(err.message))) return 'network'
  switch (code) {
    case 'invalid_credentials':
      return 'invalid'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rateLimit'
    case 'same_password':
      return 'samePassword'
    case 'weak_password':
      return 'weakPassword'
    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
    case 'session_not_found':
    case 'session_expired':
      return 'reauth'
    case 'email_not_confirmed':
      return 'unconfirmed'
  }
  if (status === 429) return 'rateLimit'
  if (status === 400 && name === 'AuthApiError') return 'invalid'
  return 'generic'
}
