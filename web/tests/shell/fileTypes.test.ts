import { describe, expect, it } from 'vitest'
import { fileTypeOf } from '@/components/shell/fileTypes'

describe('fileTypeOf', () => {
  it('maps each page file extension to its VS Code language mode', () => {
    expect(fileTypeOf('next.config.ts')).toEqual({ languageMode: 'TypeScript', braces: true })
    expect(fileTypeOf('home.tsx')).toEqual({ languageMode: 'TypeScript JSX', braces: true })
    expect(fileTypeOf('caro-app.md')).toEqual({ languageMode: 'Markdown', braces: false })
    expect(fileTypeOf('skills.json')).toEqual({ languageMode: 'JSON', braces: true })
    expect(fileTypeOf('cv.pdf')).toEqual({ languageMode: 'PDF', braces: false })
  })

  it('knows the config files by their whole name', () => {
    expect(fileTypeOf('page.tsx')).toEqual({ languageMode: 'TypeScript JSX', braces: true })
    expect(fileTypeOf('.gitignore')).toEqual({ languageMode: 'Ignore', braces: false })
    expect(fileTypeOf('.vercelignore')).toEqual({ languageMode: 'Ignore', braces: false })
    expect(fileTypeOf('next.config.ts')).toEqual({ languageMode: 'TypeScript', braces: true })
    expect(fileTypeOf('package.json')).toEqual({ languageMode: 'JSON', braces: true })
    expect(fileTypeOf('tsconfig.json')).toEqual({ languageMode: 'JSON with Comments', braces: true })
  })

  it('treats unknown or missing extensions as plain text', () => {
    expect(fileTypeOf('notes.txt')).toEqual({ languageMode: 'Plain Text', braces: false })
    expect(fileTypeOf('README').languageMode).toBe('Plain Text')
  })

  it('ignores extension case', () => {
    expect(fileTypeOf('CV.PDF').languageMode).toBe('PDF')
  })
})
