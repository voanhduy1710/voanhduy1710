export class ContentError extends Error {
  readonly file: string

  constructor(file: string, message: string) {
    super(`[${file}] ${message}`)
    this.name = 'ContentError'
    this.file = file
  }
}
