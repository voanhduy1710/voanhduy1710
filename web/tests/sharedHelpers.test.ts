import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { contentPath } from '@/lib/contentDir'
import { DEFAULT_SUPABASE_URL, supabaseBaseUrl } from '@/lib/supabase'

afterEach(() => vi.unstubAllEnvs())

describe('contentPath', () => {
  it('defaults to content/ in the working directory', () => {
    vi.stubEnv('CONTENT_DIR', '')
    expect(contentPath('README.md')).toBe(join(process.cwd(), 'content', 'README.md'))
  })

  it('follows $CONTENT_DIR, relative or absolute', () => {
    vi.stubEnv('CONTENT_DIR', 'tests/fixtures')
    expect(contentPath('a', 'b.json')).toBe(resolve(process.cwd(), 'tests/fixtures', 'a', 'b.json'))
    const abs = resolve('/somewhere/else')
    vi.stubEnv('CONTENT_DIR', abs)
    expect(contentPath('x.md')).toBe(join(abs, 'x.md'))
  })
})

describe('supabaseBaseUrl', () => {
  it('is the site project unless SUPABASE_URL is set; trailing slashes trimmed', () => {
    vi.stubEnv('SUPABASE_URL', '')
    expect(supabaseBaseUrl()).toBe(DEFAULT_SUPABASE_URL)
    vi.stubEnv('SUPABASE_URL', ' https://other.supabase.co// ')
    expect(supabaseBaseUrl()).toBe('https://other.supabase.co')
  })
})
