'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

export type GalleryImage = { src: string; alt: string }

type Labels = { open: string; close: string; previous: string; next: string }

/**
 * Screenshot grid; clicking one opens it full size in a modal `<dialog>`.
 * Esc or a click on the backdrop closes it; the arrow buttons / keys step through the set.
 * `src` values are served URLs (already passed through `assetUrl`).
 */
export function ImageGallery({ images, labels }: { images: GalleryImage[]; labels: Labels }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState<number | null>(null)
  const many = images.length > 1

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (index !== null && !d.open) d.showModal()
    if (index === null && d.open) d.close()
  }, [index])

  const step = (by: number) => setIndex((i) => (i === null ? i : (i + by + images.length) % images.length))
  const current = index === null ? undefined : images[index]

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        {images.map((img, i) => (
          <li key={img.src}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${labels.open}: ${img.alt}`}
              className="group relative block aspect-[16/10] w-full cursor-zoom-in overflow-hidden rounded-md border border-vsc-border bg-black/30 hover:border-vsc-accent"
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                loading={i < 2 ? 'eager' : 'lazy'}
                sizes="(min-width: 1024px) 440px, (min-width: 640px) 45vw, 100vw"
                className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label={current?.alt}
        onClose={() => setIndex(null)}
        onClick={(e) => e.target === e.currentTarget && setIndex(null)}
        onKeyDown={(e) => {
          if (!many) return
          if (e.key === 'ArrowLeft') step(-1)
          if (e.key === 'ArrowRight') step(1)
        }}
        className="m-auto h-dvh max-h-none w-dvw max-w-none bg-transparent p-0 text-vsc-text backdrop:bg-black/85"
      >
        {current && (
          <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-3 p-4 sm:p-10">
            <div className="relative h-full w-full">
              <Image src={current.src} alt={current.alt} fill sizes="100vw" className="object-contain" />
            </div>
            <p className="text-sm text-vsc-muted">
              {current.alt}
              {many && <span className="ml-2 font-mono text-xs">{`${index! + 1}/${images.length}`}</span>}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIndex(null)}
          aria-label={labels.close}
          title={labels.close}
          className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded bg-black/50 text-xl text-white hover:bg-white/15"
        >
          ×
        </button>
        {many && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={labels.previous}
              title={labels.previous}
              className="absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded bg-black/50 text-2xl text-white hover:bg-white/15"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={labels.next}
              title={labels.next}
              className="absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded bg-black/50 text-2xl text-white hover:bg-white/15"
            >
              ›
            </button>
          </>
        )}
      </dialog>
    </>
  )
}
