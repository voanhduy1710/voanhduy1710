'use client'

import { lazy, Suspense } from 'react'
import type { Lang } from '@/lib/content/types'
import { accountName } from '@/lib/auth/username'
import { authConfigured } from '@/lib/auth/client'
import { signOut, useAuth } from '@/lib/auth/session'
import { accountMenuItems } from './accountMenu'
import { AccountIcon, KeyIcon, SignInIcon, SignOutIcon } from './icons'

export type AuthMenuLabels = { login: string; logout: string; changePassword: string; account: string }
export type AuthDialogKind = 'login' | 'password'

const loadDialog = () => import('./AuthDialog')
const AuthDialog = lazy(loadDialog)

/** Starts fetching the dialog chunk (when the Accounts menu opens), so "Log in" opens without a wait. */
export function preloadAuthDialog(): void {
  void loadDialog().catch(() => undefined)
}

/** The login items of the Accounts menu (see accountMenuItems). */
export function AccountAuthItems({
  labels,
  itemClass,
  close,
  openDialog,
}: {
  labels: AuthMenuLabels
  itemClass: string
  close: () => void
  openDialog: (kind: AuthDialogKind) => void
}) {
  const auth = useAuth()
  const items = accountMenuItems(auth, authConfigured())
  if (items.length === 0) return null
  return (
    <>
      <div role="separator" className="mx-[0.3rem] my-[0.2rem] h-px bg-[#454545]" />
      {items.map((item) => {
        switch (item) {
          case 'account':
            return (
              <div key={item} role="none" className="flex items-center gap-[0.42rem] px-[0.52rem] py-[0.25rem] text-vsc-muted [&>svg]:size-(--ui-icon)">
                <AccountIcon />
                <span>
                  {labels.account} <span className="text-vsc-heading">{auth.status === 'signedIn' ? accountName(auth.email) : ''}</span>
                </span>
              </div>
            )
          case 'login':
            return (
              <button key={item} type="button" role="menuitem" className={itemClass} onClick={() => (close(), openDialog('login'))}>
                <SignInIcon />
                {labels.login}
              </button>
            )
          case 'changePassword':
            return (
              <button key={item} type="button" role="menuitem" className={itemClass} onClick={() => (close(), openDialog('password'))}>
                <KeyIcon />
                {labels.changePassword}
              </button>
            )
          case 'logout':
            return (
              <button key={item} type="button" role="menuitem" className={itemClass} onClick={() => (close(), void signOut().catch(() => undefined))}>
                <SignOutIcon />
                {labels.logout}
              </button>
            )
        }
      })}
    </>
  )
}

/** The open login / change-password dialog (lazy chunk; nothing is rendered or downloaded until one is opened). */
export function AuthDialogHost({ lang, kind, onClose }: { lang: Lang; kind: AuthDialogKind | null; onClose: () => void }) {
  if (!kind) return null
  return (
    <Suspense fallback={null}>
      <AuthDialog lang={lang} kind={kind} onClose={onClose} />
    </Suspense>
  )
}
