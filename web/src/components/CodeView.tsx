import type { NavIcon } from '@/lib/nav'
import { tokenize, type TokenKind } from '@/lib/highlight'
import type { RepoFileSyntax } from '@/lib/repoFiles'
import { ChevronIcon, PageIcon } from './shell/icons'

/** VS Code Dark Modern token colours. */
const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: '',
  comment: 'text-[#6a9955]',
  string: 'text-[#ce9178]',
  number: 'text-[#b5cea8]',
  keyword: 'text-[#569cd6]',
  control: 'text-[#c586c0]',
  literal: 'text-[#569cd6]',
  key: 'text-[#9cdcfe]',
  type: 'text-[#4ec9b0]',
  func: 'text-[#dcdcaa]',
  punct: 'text-[#d4d4d4]',
  negate: 'text-[#c586c0]',
}

/**
 * A read-only, VS Code-like view of one file: breadcrumb (`root › name`), line-number gutter and light syntax colour.
 * Server-rendered; no client JavaScript.
 */
export function CodeView({
  root,
  name,
  icon,
  syntax,
  text,
}: {
  root: string
  name: string
  icon: NavIcon
  syntax: RepoFileSyntax
  text: string
}) {
  const lines = tokenize(text, syntax)
  return (
    <div className="min-h-full bg-vsc-editor">
      <nav
        aria-label="Breadcrumb"
        className="sticky top-0 z-10 flex h-(--ui-row) items-center gap-[0.2rem] bg-vsc-editor px-[0.94rem] font-ui text-(length:--ui-text-sm) text-[#a9a9a9] select-none"
      >
        <span>{root}</span>
        <ChevronIcon aria-hidden className="size-(--ui-icon) text-vsc-muted" />
        <PageIcon icon={icon} />
        <span className="text-vsc-text">{name}</span>
      </nav>
      <h1 className="sr-only">{name}</h1>
      <pre className="overflow-x-auto pb-10 font-mono text-[0.729rem] leading-[1.6] text-[#cccccc]">
        <code className="block min-w-max">
          {lines.map((line, i) => (
            <span key={i} className="flex">
              <span aria-hidden className="w-[3.4rem] shrink-0 pr-[1.6rem] text-right text-[#6e7681] select-none">
                {i + 1}
              </span>
              <span className="pr-8 whitespace-pre">
                {line.map((t, j) => (
                  <span key={j} className={TOKEN_CLASS[t.kind] || undefined}>
                    {t.text}
                  </span>
                ))}
                {/* An empty line still takes its height, and copying keeps its newline. */}
                {'\n'}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}
