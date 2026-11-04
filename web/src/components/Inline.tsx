import { Fragment, type ReactNode } from 'react'
import type { Inline as InlineNode } from '@/lib/content/types'

const EXTERNAL = /^https?:\/\//i

/** Text with hard line breaks (`\n`) rendered as `<br />`. */
function textWithBreaks(value: string): ReactNode {
  const lines = value.split('\n')
  if (lines.length === 1) return value
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ))
}

function render(node: InlineNode, key: number): ReactNode {
  switch (node.kind) {
    case 'text':
      return <Fragment key={key}>{textWithBreaks(node.value)}</Fragment>
    case 'strong':
      return (
        <strong key={key} className="font-semibold text-vsc-heading">
          <Inline nodes={node.children} />
        </strong>
      )
    case 'em':
      return (
        <em key={key}>
          <Inline nodes={node.children} />
        </em>
      )
    case 'code':
      return (
        <code key={key} className="rounded bg-white/5 px-1 py-0.5 font-mono text-[0.9em] text-vsc-code">
          {node.value}
        </code>
      )
    case 'link': {
      const external = EXTERNAL.test(node.href)
      return (
        <a
          key={key}
          href={node.href}
          className="text-vsc-link underline-offset-2 hover:underline"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <Inline nodes={node.children} />
        </a>
      )
    }
  }
}

/** Renders README inline content (text, bold, italic, code, links). */
export function Inline({ nodes }: { nodes: InlineNode[] }) {
  return <>{nodes.map(render)}</>
}
