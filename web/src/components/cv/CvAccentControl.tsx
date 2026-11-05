'use client'

import { useEffect, useRef, useState } from 'react'
import type { Lang } from '@/lib/content/types'
import { hasStoredSession } from '@/lib/auth/client'
import { connect } from '@/lib/auth/session'
import { ACCENT_FAMILIES, contrastRatio, DEFAULT_ACCENT, MIN_CONTRAST, normalizeHex, presetName } from '@/lib/cv/accent'
import { applyAccent, cacheAccent, cachedAccent, fetchAccent, saveAccent } from '@/lib/cv/accentStore'
import { ui } from '@/lib/i18n/ui'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DELAY_MS = 600

/** The colour cached by an earlier visit of the signed-in owner (only when a session is stored). */
function initialAccent(): string {
  if (typeof window === 'undefined' || !hasStoredSession()) return DEFAULT_ACCENT
  return cachedAccent() ?? DEFAULT_ACCENT
}

/**
 * Owner-only "Colour" control of the CV toolbar (a lazy chunk: CvAccentGate loads it only for a signed-in user): preset swatches by family (CV_colors.html + Blues; Pine is the
 * default) and a free colour picker with a hex field. The colour applies at once (and to Print / Save as PDF), is
 * cached in this browser and saved to the owner's `cv_preferences` row. Hidden unless signed in; visitors always get
 * the default accent.
 */
export default function CvAccentControl({ lang, userId }: { lang: Lang; userId: string }) {
  const t = ui(lang)
  const [accent, setAccent] = useState(initialAccent)
  const [hexText, setHexText] = useState(accent)
  const [open, setOpen] = useState(false)
  const [save, setSave] = useState<SaveState>('idle')
  const boxRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Load the saved colour of this account.
  useEffect(() => {
    let live = true
    void connect()
      .then((client) => (client ? fetchAccent(client, userId) : null))
      .then((saved) => {
        if (!live || !saved) return
        setAccent(saved)
        setHexText(saved)
        applyAccent(saved)
        cacheAccent(saved)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [userId])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  function choose(hex: string, fromText = false) {
    setAccent(hex)
    if (!fromText) setHexText(hex)
    applyAccent(hex === DEFAULT_ACCENT ? null : hex)
    cacheAccent(hex)
    setSave('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void connect()
        .then((client) => {
          if (!client) throw new Error('offline')
          return saveAccent(client, userId, hex)
        })
        .then(
          () => setSave('saved'),
          () => setSave('error'),
        )
    }, SAVE_DELAY_MS)
  }

  const ratio = contrastRatio(accent)
  const name = presetName(accent)

  return (
    <div ref={boxRef} className="relative mr-auto">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded border border-vsc-border bg-vsc-sidebar px-4 py-2 text-sm font-medium text-vsc-heading hover:border-vsc-accent"
      >
        <span aria-hidden className="size-3.5 rounded-sm border border-white/30" style={{ background: accent }} />
        {t.cvColour}
        <span className="font-mono text-xs text-vsc-muted">{name ?? accent}</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t.cvColourTitle}
          className="absolute top-[calc(100%+0.4rem)] left-0 z-50 max-h-[calc(100dvh-11rem)] w-[min(26.5rem,calc(100vw-2rem))] overflow-y-auto rounded-[6px] border border-[#454545] bg-[#252526] p-3 font-ui text-(length:--ui-text-sm) text-vsc-text shadow-[0_8px_32px_rgb(0_0_0/0.6)]"
        >
          <p className="mb-2 font-semibold tracking-wide text-vsc-heading uppercase">{t.cvColourTitle}</p>
          <div className="space-y-1.5">
            {ACCENT_FAMILIES.map((f) => (
              <div key={f.family}>
                <p className="mb-1 text-vsc-muted">{f.family}</p>
                <div className="flex flex-wrap gap-1.5">
                  {f.colours.map((c) => {
                    const selected = c.hex === accent
                    const isDefault = c.hex === DEFAULT_ACCENT
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${c.name} ${c.hex}${isDefault ? ` (${t.cvColourDefault})` : ''}`}
                        title={`${c.name} ${c.hex}${isDefault ? ` – ${t.cvColourDefault}` : ''}`}
                        onClick={() => choose(c.hex)}
                        className={`flex w-[4.75rem] flex-col items-start gap-0.5 rounded-[3px] border p-1 text-left hover:border-white/60 ${selected ? 'border-white' : 'border-transparent'}`}
                      >
                        <span aria-hidden className="h-4 w-full rounded-[2px]" style={{ background: c.hex }} />
                        <span className="w-full truncate text-[0.6rem] leading-tight">
                          {c.name}
                          {isDefault && <span className="text-vsc-muted"> · {t.cvColourDefault}</span>}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-[#454545] pt-3">
            <p className="mb-1 text-vsc-muted">{t.cvColourCustom}</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={t.cvColourCustom}
                value={accent}
                onChange={(e) => {
                  const hex = normalizeHex(e.target.value)
                  if (hex) choose(hex)
                }}
                className="h-7 w-10 cursor-pointer rounded-[2px] border border-[#3c3c3c] bg-[#3c3c3c] p-0.5"
              />
              <input
                type="text"
                aria-label={t.cvColourHex}
                value={hexText}
                maxLength={7}
                spellCheck={false}
                autoCapitalize="none"
                onChange={(e) => {
                  setHexText(e.target.value)
                  const hex = normalizeHex(e.target.value)
                  if (hex && /^#?[0-9a-f]{6}$/i.test(e.target.value.trim())) choose(hex, true)
                }}
                className="w-24 rounded-[2px] border border-[#3c3c3c] bg-[#3c3c3c] px-2 py-1 font-mono text-vsc-heading outline-none focus:border-vsc-accent"
              />
              <button
                type="button"
                onClick={() => choose(DEFAULT_ACCENT)}
                disabled={accent === DEFAULT_ACCENT}
                className="ml-auto rounded-[2px] bg-[#3a3d41] px-2 py-1 text-white hover:bg-[#45494e] disabled:opacity-50"
              >
                {t.cvColourReset}
              </button>
            </div>
            {ratio < MIN_CONTRAST && (
              <p role="alert" className="mt-2 rounded-[2px] border border-[#cca700] bg-[#3b3417] px-2 py-1 text-[#f5e3a3]">
                {t.cvColourLowContrast.replace('{ratio}', ratio.toFixed(2))}
              </p>
            )}
            <p className="mt-2 text-vsc-muted">{t.cvColourNote}</p>
            <p role="status" className="mt-1 min-h-[1.2em] text-vsc-muted">
              {save === 'saving' ? t.cvColourSaving : save === 'saved' ? t.cvColourSaved : save === 'error' ? t.cvColourSaveError : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
