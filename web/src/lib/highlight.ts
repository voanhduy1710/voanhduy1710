/**
 * A tiny syntax tokenizer for the read-only code view: just enough colour for JSON (with comments), TypeScript and
 * ignore files. Not a parser; unknown text is passed through as `plain`, so every input character is kept.
 */
import type { RepoFileSyntax } from './repoFiles'

export type TokenKind =
  | 'plain'
  | 'comment'
  | 'string'
  | 'number'
  /** Declarations and operators-as-words: `const`, `async`, `typeof`, `type`. */
  | 'keyword'
  /** Module / control-flow words: `import`, `export`, `from`, `return`, `if`. */
  | 'control'
  /** `true`, `false`, `null`, `undefined`. */
  | 'literal'
  /** A JSON object key, or a TS name followed by `:`. */
  | 'key'
  /** A capitalised TS name (`NextConfig`). */
  | 'type'
  /** A TS name followed by `(`. */
  | 'func'
  | 'punct'
  /** The `!` that starts an ignore-file negation. */
  | 'negate'

export type Token = { kind: TokenKind; text: string }

const TS_KEYWORDS = new Set([
  'as', 'async', 'await', 'class', 'const', 'declare', 'enum', 'extends', 'function', 'implements', 'in',
  'instanceof', 'interface', 'keyof', 'let', 'new', 'of', 'readonly', 'satisfies', 'static', 'this', 'type',
  'typeof', 'var', 'void',
])
const TS_CONTROL = new Set([
  'break', 'case', 'catch', 'continue', 'default', 'do', 'else', 'export', 'finally', 'for', 'from', 'if',
  'import', 'return', 'switch', 'throw', 'try', 'while', 'yield',
])
const LITERALS = new Set(['true', 'false', 'null', 'undefined'])

const NUMBER = /-?(?:0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/y
const IDENT = /[A-Za-z_$][\w$]*/y
const SPACE = /[ \t]*/y

function matchAt(re: RegExp, s: string, i: number): string | undefined {
  re.lastIndex = i
  return re.exec(s)?.[0]
}

/** End index (exclusive) of the quoted string starting at `i`, honouring backslash escapes; stops at a newline unless `multiline`. */
function stringEnd(s: string, i: number, multiline: boolean): number {
  const quote = s[i]
  let j = i + 1
  while (j < s.length) {
    const c = s[j]
    if (c === '\\') j += 2
    else if (c === quote) return j + 1
    else if (c === '\n' && !multiline) return j
    else j++
  }
  return s.length
}

/** Next non-space character at or after `i` on the same line. */
function nextChar(s: string, i: number): string | undefined {
  return s[i + (matchAt(SPACE, s, i)?.length ?? 0)]
}

/** A `//` or `/* *\/` comment starting at `i`, if any. */
function commentAt(s: string, i: number): string | undefined {
  if (s[i] !== '/') return undefined
  if (s[i + 1] === '/') {
    const nl = s.indexOf('\n', i)
    return s.slice(i, nl === -1 ? s.length : nl)
  }
  if (s[i + 1] === '*') {
    const end = s.indexOf('*/', i + 2)
    return s.slice(i, end === -1 ? s.length : end + 2)
  }
  return undefined
}

function tokenizeCode(s: string, ts: boolean): Token[] {
  const out: Token[] = []
  const push = (kind: TokenKind, text: string) => {
    const last = out[out.length - 1]
    if (last && last.kind === kind && kind === 'plain') last.text += text
    else out.push({ kind, text })
  }
  let i = 0
  while (i < s.length) {
    const c = s[i]
    const comment = commentAt(s, i)
    if (comment) {
      push('comment', comment)
      i += comment.length
      continue
    }
    if (c === '"' || (ts && (c === "'" || c === '`'))) {
      const end = stringEnd(s, i, c === '`')
      const text = s.slice(i, end)
      push(!ts && nextChar(s, end) === ':' ? 'key' : 'string', text)
      i = end
      continue
    }
    const prev = s[i - 1]
    const num = /[\d-]/.test(c) && !(prev && /[\w$]/.test(prev)) ? matchAt(NUMBER, s, i) : undefined
    if (num && num !== '-') {
      push('number', num)
      i += num.length
      continue
    }
    const ident = matchAt(IDENT, s, i)
    if (ident) {
      const after = nextChar(s, i + ident.length)
      let kind: TokenKind = 'plain'
      if (LITERALS.has(ident)) kind = 'literal'
      else if (ts && TS_CONTROL.has(ident)) kind = 'control'
      else if (ts && TS_KEYWORDS.has(ident)) kind = 'keyword'
      else if (ts && after === '(') kind = 'func'
      else if (ts && after === ':' && prev !== '?') kind = 'key'
      else if (ts && /^[A-Z]/.test(ident)) kind = 'type'
      push(kind, ident)
      i += ident.length
      continue
    }
    push(/[{}[\](),:;.=<>+*?!&|]/.test(c) ? 'punct' : 'plain', c)
    i++
  }
  return out
}

/** Ignore files: `#` lines are comments, a leading `!` negates; patterns stay plain. */
function tokenizeIgnore(s: string): Token[] {
  return s.split('\n').flatMap((line, n): Token[] => {
    const nl: Token[] = n === 0 ? [] : [{ kind: 'plain', text: '\n' }]
    if (line === '') return nl
    const trimmed = line.trimStart()
    const lead = line.slice(0, line.length - trimmed.length)
    const pre: Token[] = lead ? [{ kind: 'plain', text: lead }] : []
    if (trimmed.startsWith('#')) return [...nl, ...pre, { kind: 'comment', text: trimmed }]
    if (trimmed.startsWith('!')) {
      const rest: Token[] = trimmed.length > 1 ? [{ kind: 'plain', text: trimmed.slice(1) }] : []
      return [...nl, ...pre, { kind: 'negate', text: '!' }, ...rest]
    }
    return [...nl, ...pre, { kind: 'plain', text: trimmed }]
  })
}

/** Splits a flat token list into lines; a token spanning newlines (block comment, template string) is cut at each one. */
export function splitLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]]
  for (const t of tokens) {
    const parts = t.text.split('\n')
    parts.forEach((part, k) => {
      if (k > 0) lines.push([])
      if (part !== '') lines[lines.length - 1].push({ kind: t.kind, text: part })
    })
  }
  return lines
}

/** The text as lines of coloured tokens. Joining every line's token texts with `\n` gives the input back. */
export function tokenize(text: string, syntax: RepoFileSyntax): Token[][] {
  const tokens = syntax === 'ignore' ? tokenizeIgnore(text) : tokenizeCode(text, syntax === 'ts')
  return splitLines(tokens)
}
