import { describe, expect, it } from 'vitest'
import { tokenize, type Token, type TokenKind } from '@/lib/highlight'

/** `[kind, text]` pairs of the non-plain tokens of every line. */
const coloured = (lines: Token[][]) => lines.map((l) => l.filter((t) => t.kind !== 'plain').map((t) => [t.kind, t.text]))
const kindOf = (lines: Token[][], text: string): TokenKind | undefined => lines.flat().find((t) => t.text === text)?.kind
const joined = (lines: Token[][]) => lines.map((l) => l.map((t) => t.text).join('')).join('\n')

describe('tokenize: JSON', () => {
  const sample = `{
  "name": "voanhduy1710-portfolio",
  "private": true,
  "version": 1.5e3,
  "neg": -2,
  "list": ["a", null],
  // a comment (tsconfig allows them)
  "paths": { "@/*": ["./src/*"] } /* tail */
}
`
  const lines = tokenize(sample, 'json')

  it('keeps every character and one entry per line (a trailing newline gives an empty last line)', () => {
    expect(joined(lines)).toBe(sample)
    expect(lines).toHaveLength(sample.split('\n').length)
    expect(lines.at(-1)).toEqual([])
  })

  it('tells keys from string values, and colours numbers, literals, comments and punctuation', () => {
    expect(coloured(lines)[1]).toEqual([
      ['key', '"name"'],
      ['punct', ':'],
      ['string', '"voanhduy1710-portfolio"'],
      ['punct', ','],
    ])
    expect(kindOf(lines, 'true')).toBe('literal')
    expect(kindOf(lines, 'null')).toBe('literal')
    expect(kindOf(lines, '1.5e3')).toBe('number')
    expect(kindOf(lines, '-2')).toBe('number')
    expect(kindOf(lines, '"a"')).toBe('string')
    expect(kindOf(lines, '"@/*"')).toBe('key')
    expect(kindOf(lines, '"./src/*"')).toBe('string')
    expect(kindOf(lines, '// a comment (tsconfig allows them)')).toBe('comment')
    expect(kindOf(lines, '/* tail */')).toBe('comment')
  })

  it('handles escaped quotes inside strings', () => {
    const l = tokenize('{"a\\"b": "c\\"d"}', 'json')
    expect(coloured(l)[0].map(([k]) => k)).toEqual(['punct', 'key', 'punct', 'string', 'punct'])
  })
})

describe('tokenize: TypeScript', () => {
  const sample = `import type { NextConfig } from "next";
/* block
   comment */
const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    return [{ source: '/', permanent: false, n: 42 }, \`a
b\`];
  },
};
export default nextConfig; // done
`
  const lines = tokenize(sample, 'ts')

  it('keeps every character', () => {
    expect(joined(lines)).toBe(sample)
  })

  it('colours keywords, control words, types, functions, keys, strings, numbers and comments', () => {
    expect(coloured(lines)[0]).toEqual([
      ['control', 'import'],
      ['keyword', 'type'],
      ['punct', '{'],
      ['type', 'NextConfig'],
      ['punct', '}'],
      ['control', 'from'],
      ['string', '"next"'],
      ['punct', ';'],
    ])
    expect(kindOf(lines, 'const')).toBe('keyword')
    expect(kindOf(lines, 'async')).toBe('keyword')
    expect(kindOf(lines, 'return')).toBe('control')
    expect(kindOf(lines, 'export')).toBe('control')
    expect(kindOf(lines, 'redirects')).toBe('func')
    expect(kindOf(lines, 'cacheComponents')).toBe('key')
    expect(kindOf(lines, "'/'")).toBe('string')
    expect(kindOf(lines, 'false')).toBe('literal')
    expect(kindOf(lines, '42')).toBe('number')
    expect(kindOf(lines, '// done')).toBe('comment')
  })

  it('splits a multi-line block comment and template string across lines, keeping the kind', () => {
    expect(lines[1]).toEqual([{ kind: 'comment', text: '/* block' }])
    expect(lines[2]).toEqual([{ kind: 'comment', text: '   comment */' }])
    expect(lines[6].at(-1)).toEqual({ kind: 'string', text: '`a' })
    expect(lines[7][0]).toEqual({ kind: 'string', text: 'b`' })
  })

  it('does not read digits inside names or a binary minus as numbers', () => {
    const l = tokenize('const es2017 = a-1', 'ts')
    expect(l[0].filter((t) => t.kind === 'number').map((t) => t.text)).toEqual(['1'])
    expect(l[0].find((t) => t.text.includes('es2017'))?.kind).toBe('plain')
  })
})

describe('tokenize: ignore files', () => {
  const sample = `# env files
.env*
!.env.example

  # indented comment
/web/.next/
!/web/.yarn/patches
`
  const lines = tokenize(sample, 'ignore')

  it('keeps every character and line', () => {
    expect(joined(lines)).toBe(sample)
    expect(lines).toHaveLength(8)
  })

  it('colours comment lines and the negation mark; patterns stay plain', () => {
    expect(coloured(lines)).toEqual([
      [['comment', '# env files']],
      [],
      [['negate', '!']],
      [],
      [['comment', '# indented comment']],
      [],
      [['negate', '!']],
      [],
    ])
    expect(lines[1]).toEqual([{ kind: 'plain', text: '.env*' }])
    expect(lines[2]).toEqual([
      { kind: 'negate', text: '!' },
      { kind: 'plain', text: '.env.example' },
    ])
  })

  it('a # inside a pattern is not a comment', () => {
    expect(tokenize('foo#bar', 'ignore')).toEqual([[{ kind: 'plain', text: 'foo#bar' }]])
  })
})
