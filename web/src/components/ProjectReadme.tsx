import { toJsxRuntime, type Components } from 'hast-util-to-jsx-runtime'
import type { ComponentProps, ReactNode } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { BadgeChip } from '@/components/BadgeChip'
import { BADGE_TAG, badgeFromProps, renderReadmeTree } from '@/lib/projectReadme/render'
import { readmeSource } from '@/lib/projectReadme/source'

/** Task-list checkboxes are read-only (React would warn about a `checked` input without onChange). */
function TaskCheckbox({ checked, ...rest }: ComponentProps<'input'>) {
  return <input {...rest} type="checkbox" disabled defaultChecked={checked} />
}

const COMPONENTS = {
  [BADGE_TAG]: (props: Record<string, unknown>) => (
    <span className="mr-1 inline-flex align-middle">
      <BadgeChip badge={badgeFromProps(props)} />
    </span>
  ),
  input: TaskCheckbox,
} as unknown as Partial<Components>

type HastNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] }

/** Placeholder element put right after the README's H1; rendered as the page's `afterTitle` content. */
const AFTER_TITLE_TAG = 'after-title'

/** Inserts the placeholder after the first H1 (as its next sibling, wherever the H1 sits). True if it found one. */
function insertAfterFirstH1(node: HastNode): boolean {
  const kids = node.children ?? []
  for (let i = 0; i < kids.length; i++) {
    if (kids[i].tagName === 'h1') {
      kids.splice(i + 1, 0, { type: 'element', tagName: AFTER_TITLE_TAG, properties: {}, children: [] })
      return true
    }
    if (insertAfterFirstH1(kids[i])) return true
  }
  return false
}

function hasH1(node: HastNode): boolean {
  return node.tagName === 'h1' || (node.children?.some(hasH1) ?? false)
}

/** Keep the first H1 as the page's <h1>; turn every later one into an <h2>. */
function demoteExtraH1s(node: HastNode, state: { seen: boolean }) {
  if (node.tagName === 'h1') {
    if (state.seen) node.tagName = 'h2'
    state.seen = true
  }
  node.children?.forEach((c) => demoteExtraH1s(c, state))
}

/** Does the README have its own H1? Then the project page uses it as its <h1> and drops the header title. */
export function readmeHasH1(repoUrl: string, markdown: string, slug: string, images: readonly string[]): boolean {
  return hasH1(renderReadmeTree(markdown, { slug, source: readmeSource(repoUrl), images: new Set(images) }) as HastNode)
}

/**
 * A project's own README, rendered at build time (server component, no client JS). Its first H1 is the page's <h1>
 * (any later H1 is demoted to <h2>). `note` ("README gốc bằng tiếng Anh" on /vi when the repo has no READMEVN.md)
 * is shown above it.
 * `afterTitle` (the page's live/repo links row) is placed directly after that H1, before the README's badges and
 * body; without an H1 it goes first.
 */
export function ProjectReadme({
  slug,
  repoUrl,
  markdown,
  images,
  note,
  afterTitle,
  dropLanguageLink = false,
}: {
  slug: string
  repoUrl: string
  markdown: string
  images: readonly string[]
  note?: string
  afterTitle?: ReactNode
  /** READMEVN.md on /vi: drop its `> 🇬🇧 English version: [README.md](README.md)` line (the site has its own switch). */
  dropLanguageLink?: boolean
}) {
  const tree = renderReadmeTree(markdown, { slug, source: readmeSource(repoUrl), images: new Set(images), dropLanguageLink })
  demoteExtraH1s(tree as HastNode, { seen: false })
  const placed = afterTitle !== undefined && insertAfterFirstH1(tree as HastNode)
  const components = {
    ...COMPONENTS,
    [AFTER_TITLE_TAG]: () => <div className="mb-6">{afterTitle}</div>,
  } as unknown as Partial<Components>
  return (
    <section aria-label="README" className="mt-8">
      {note && <p className="mb-3 text-xs text-vsc-muted italic">{note}</p>}
      {afterTitle !== undefined && !placed && <div className="mb-6">{afterTitle}</div>}
      <div className="markdown-body">{toJsxRuntime(tree, { Fragment, jsx, jsxs, components })}</div>
    </section>
  )
}
