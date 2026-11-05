'use client'

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Lang } from '@/lib/content/types'
import { authErrorKind, type AuthErrorKind } from '@/lib/auth/errors'
import { changePassword, connect, signIn } from '@/lib/auth/session'
import { loginEmail, MIN_PASSWORD_LENGTH } from '@/lib/auth/username'
import { ui, type UiStrings } from '@/lib/i18n/ui'
import type { AuthDialogKind } from './AccountAuth'
import { CloseIcon } from './icons'

/**
 * VS Code-style modal for the owner login and password change (a lazy chunk of the account menu). There is no sign-up
 * and no "forgot password": the only account is created in Supabase, and a lost password is reset from the dashboard.
 */
export default function AuthDialog({ lang, kind, onClose }: { lang: Lang; kind: AuthDialogKind; onClose: () => void }) {
  const t = ui(lang)
  const titleId = useId()
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void connect() // fetch supabase-js while the form is being filled in
    const opener = document.activeElement as HTMLElement | null
    boxRef.current?.querySelector<HTMLInputElement>('input:not([hidden])')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && boxRef.current) {
        // Keep Tab inside the dialog.
        const f = [...boxRef.current.querySelectorAll<HTMLElement>('input:not([hidden]), button:not([disabled])')]
        if (f.length === 0) return
        const first = f[0]
        const last = f[f.length - 1]
        const wrapTo = e.shiftKey ? (document.activeElement === first ? last : null) : document.activeElement === last ? first : null
        if (wrapTo) {
          e.preventDefault()
          wrapTo.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[12vh] font-ui print:hidden" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-[min(24rem,calc(100vw-2rem))] rounded-[6px] border border-[#454545] bg-[#252526] text-(length:--ui-text) text-vsc-text shadow-[0_8px_32px_rgb(0_0_0/0.6)]"
      >
        <div className="flex items-center justify-between border-b border-[#454545] px-[0.75rem] py-[0.45rem]">
          <h2 id={titleId} className="text-(length:--ui-text-sm) font-semibold tracking-wide text-vsc-heading uppercase">
            {kind === 'login' ? t.authDialogLogin : t.authDialogPassword}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.authClose} className="rounded p-[0.15rem] text-[#c5c5c5] hover:bg-[#3c3c3c] [&>svg]:size-(--ui-icon)">
            <CloseIcon />
          </button>
        </div>
        {kind === 'login' ? <LoginForm t={t} onDone={onClose} onCancel={onClose} /> : <PasswordForm t={t} onCancel={onClose} />}
      </div>
    </div>
  )
}

const input =
  'mt-[0.2rem] w-full rounded-[2px] border border-[#3c3c3c] bg-[#3c3c3c] px-[0.45rem] py-[0.3rem] text-vsc-heading outline-none placeholder:text-[#8b8b8b] focus:border-vsc-accent'
const primary = 'rounded-[2px] bg-vsc-accent px-[0.8rem] py-[0.3rem] text-white hover:bg-[#026ec1] disabled:opacity-60'
const secondary = 'rounded-[2px] bg-[#3a3d41] px-[0.8rem] py-[0.3rem] text-white hover:bg-[#45494e]'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-(length:--ui-text-sm) text-vsc-muted">{label}</span>
      {children}
    </label>
  )
}

function Message({ kind, text }: { kind: 'error' | 'ok'; text: string }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-[2px] border px-[0.5rem] py-[0.3rem] text-(length:--ui-text-sm) ${kind === 'error' ? 'border-[#be1100] bg-[#5a1d1d] text-[#f2c0c0]' : 'border-[#2e7d32] bg-[#1e3a22] text-[#c8e6c9]'}`}
    >
      {text}
    </p>
  )
}

function errorText(t: UiStrings, kind: AuthErrorKind): string {
  switch (kind) {
    case 'invalid':
      return t.authErrInvalid
    case 'rateLimit':
      return t.authErrRateLimit
    case 'network':
      return t.authErrNetwork
    case 'unconfirmed':
      return t.authErrUnconfirmed
    case 'samePassword':
      return t.authErrSame
    case 'weakPassword':
      return t.authErrWeak
    case 'reauth':
      return t.authErrReauth
    default:
      return t.authErrGeneric
  }
}

function LoginForm({ t, onDone, onCancel }: { t: UiStrings; onDone: () => void; onCancel: () => void }) {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const email = loginEmail(user)
    if (!email || !password) return setError(t.authErrMissing)
    setBusy(true)
    setError('')
    try {
      await signIn(email, password)
      onDone()
    } catch (err) {
      setError(errorText(t, authErrorKind(err)))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-[0.6rem] px-[0.75rem] py-[0.7rem]">
      <Field label={t.authUser}>
        <input
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t.authUserPlaceholder}
          value={user}
          onChange={(e) => setUser(e.target.value)}
          className={input}
        />
      </Field>
      <Field label={t.authPassword}>
        <input name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      </Field>
      {error && <Message kind="error" text={error} />}
      <div className="flex justify-end gap-[0.4rem] pt-[0.1rem]">
        <button type="button" onClick={onCancel} className={secondary}>
          {t.authCancel}
        </button>
        <button type="submit" disabled={busy} className={primary}>
          {busy ? t.authWorking : t.authSubmitLogin}
        </button>
      </div>
    </form>
  )
}

function PasswordForm({ t, onCancel }: { t: UiStrings; onCancel: () => void }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t.authErrShort)
    if (password !== repeat) return setError(t.authErrMismatch)
    setBusy(true)
    setError('')
    try {
      await changePassword(password)
      setPassword('')
      setRepeat('')
      setDone(true)
    } catch (err) {
      setError(errorText(t, authErrorKind(err)))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-[0.6rem] px-[0.75rem] py-[0.7rem]">
        <Message kind="ok" text={t.authPasswordChanged} />
        <div className="flex justify-end">
          <button type="button" onClick={onCancel} className={primary}>
            {t.authClose}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-[0.6rem] px-[0.75rem] py-[0.7rem]">
      {/* Lets password managers attach the new password to the right account. */}
      <input type="text" name="username" autoComplete="username" value="voanhduy1710" readOnly hidden />
      <Field label={t.authNewPassword}>
        <input name="new-password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      </Field>
      <Field label={t.authConfirmPassword}>
        <input name="confirm-password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={repeat} onChange={(e) => setRepeat(e.target.value)} className={input} />
      </Field>
      {error && <Message kind="error" text={error} />}
      <div className="flex justify-end gap-[0.4rem] pt-[0.1rem]">
        <button type="button" onClick={onCancel} className={secondary}>
          {t.authCancel}
        </button>
        <button type="submit" disabled={busy} className={primary}>
          {busy ? t.authWorking : t.authSubmitPassword}
        </button>
      </div>
    </form>
  )
}
