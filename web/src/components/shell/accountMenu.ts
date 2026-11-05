import type { AuthState } from '@/lib/auth/session'

export type AccountMenuItem = 'login' | 'account' | 'changePassword' | 'logout'

/**
 * The login part of the Accounts menu (after LinkedIn / Email / Download CV). Signed out: "Log in" only (never a sign-up
 * or forgot-password item). Signed in: the account name, "Change password", "Log out". Nothing while the state is not
 * known yet, or when the build has no Supabase settings.
 */
export function accountMenuItems(state: AuthState, configured: boolean): AccountMenuItem[] {
  if (!configured) return []
  switch (state.status) {
    case 'signedOut':
      return ['login']
    case 'signedIn':
      return ['account', 'changePassword', 'logout']
    default:
      return []
  }
}
