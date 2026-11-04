export type FileType = {
  /** Language mode shown in the status bar, as VS Code names it. */
  languageMode: string
  /** VS Code prefixes `{ }` to the language mode of languages it has a language server for. */
  braces: boolean
}

const BY_EXTENSION: Record<string, FileType> = {
  ts: { languageMode: 'TypeScript', braces: true },
  tsx: { languageMode: 'TypeScript JSX', braces: true },
  md: { languageMode: 'Markdown', braces: false },
  json: { languageMode: 'JSON', braces: true },
  pdf: { languageMode: 'PDF', braces: false },
}

/** Files VS Code recognises by their whole name rather than the extension. */
const BY_NAME: Record<string, FileType> = {
  '.gitignore': { languageMode: 'Ignore', braces: false },
  '.vercelignore': { languageMode: 'Ignore', braces: false },
  'tsconfig.json': { languageMode: 'JSON with Comments', braces: true },
}

const TEXT: FileType = { languageMode: 'Plain Text', braces: false }

/** File type of a page's file, by its name or else its extension; anything unknown is plain text. */
export function fileTypeOf(fileName: string): FileType {
  const byName = BY_NAME[fileName.toLowerCase()]
  if (byName) return byName
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return TEXT
  return BY_EXTENSION[fileName.slice(dot + 1).toLowerCase()] ?? TEXT
}
