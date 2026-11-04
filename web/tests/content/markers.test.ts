import { describe, expect, it } from 'vitest'
import { extractProjectBlocks, extractSections } from '@/lib/content/markers'
import { SECTION_IDS } from '@/lib/content/types'

function withAllOtherSections(md: string, present: string[] = ['summary']): string {
  const others = SECTION_IDS.filter((id) => !present.includes(id))
    .map((id) => `<!-- section: ${id} -->\n<!-- /section -->`)
    .join('\n')
  return `${md}\n${others}`
}

describe('extractSections', () => {
  it('extracts a section body between markers', () => {
    const md = '<!-- section: summary -->\n## Summary\nHello\n<!-- /section -->'
    const out = extractSections(withAllOtherSections(md), 'README.md')
    expect(out.summary).toContain('Hello')
    expect(out.summary).toContain('## Summary')
  })

  it('tolerates spacing in markers', () => {
    const md = '<!--section:summary-->\nHello\n<!--/section-->'
    expect(extractSections(withAllOtherSections(md), 'README.md').summary).toContain('Hello')
    const md2 = '<!--   section:   summary   -->\nHi\n<!--   /section   -->'
    expect(extractSections(withAllOtherSections(md2), 'README.md').summary).toContain('Hi')
  })

  it('throws on unknown id naming the file and valid ids', () => {
    expect(() => extractSections('<!-- section: experiance -->x<!-- /section -->', 'README.md')).toThrow(
      /\[README\.md\].*experiance.*valid ids: header, summary/,
    )
  })

  it('rejects a sloppy id with capitals as an unknown id', () => {
    expect(() => extractSections('<!-- section: Summary -->x<!-- /section -->', 'README.md')).toThrow(
      /\[README\.md\].*unknown section id: Summary.*valid ids: header/,
    )
    expect(() => extractSections('<!-- section: tech_stack -->x<!-- /section -->', 'README.md')).toThrow(
      /unknown section id: tech_stack/,
    )
  })

  it('allows space before the colon and inside the closing marker', () => {
    const md = '<!-- section : summary -->\nHello\n<!-- / section -->'
    expect(extractSections(withAllOtherSections(md), 'README.md').summary).toContain('Hello')
  })

  it('rejects an id with a space instead of skipping the marker', () => {
    expect(() => extractSections('<!-- section: tech stack -->x<!-- /section -->', 'README.md')).toThrow(
      /\[README\.md\] unknown section id: tech stack \(valid ids: header,/,
    )
  })

  it('throws on missing section', () => {
    const md = '<!-- section: summary -->\nx\n<!-- /section -->'
    const all = SECTION_IDS.filter((id) => id !== 'contact' && id !== 'summary')
      .map((id) => `<!-- section: ${id} -->\n<!-- /section -->`)
      .join('\n')
    expect(() => extractSections(`${md}\n${all}`, 'README.md')).toThrow(/\[README\.md\].*missing section: contact/)
  })

  it('throws on duplicate section', () => {
    const md = '<!-- section: summary -->a<!-- /section -->\n<!-- section: summary -->b<!-- /section -->'
    expect(() => extractSections(withAllOtherSections(md), 'README.md')).toThrow(/duplicate section: summary/)
  })

  it('throws on unclosed section', () => {
    const md = '<!-- section: summary -->\nHello'
    expect(() => extractSections(md, 'README.md')).toThrow(/\[README\.md\].*unclosed section: summary/)
  })

  it('throws on nested section', () => {
    const md = '<!-- section: summary -->\n<!-- section: skills -->\n<!-- /section -->\n<!-- /section -->'
    expect(() => extractSections(md, 'README.md')).toThrow(/nested section/)
  })

  it('throws on a stray closing marker', () => {
    expect(() => extractSections('<!-- /section -->', 'README.md')).toThrow(/unexpected closing marker/)
  })
})

describe('extractProjectBlocks', () => {
  it('splits project blocks in order', () => {
    const s = 'intro\n<!-- project: a -->\n#### A\n<!-- project: b -->\n#### B'
    const blocks = extractProjectBlocks(s, 'f')
    expect(blocks.map((b) => b.slug)).toEqual(['a', 'b'])
    expect(blocks[0].markdown).toContain('#### A')
    expect(blocks[0].markdown).not.toContain('#### B')
    expect(blocks[1].markdown).toContain('#### B')
  })

  it('throws on duplicate slug within a section', () => {
    const s = '<!-- project: a -->\nx\n<!-- project: a -->\ny'
    expect(() => extractProjectBlocks(s, 'f')).toThrow(/\[f\].*duplicate project: a/)
  })

  it('throws on an invalid project slug', () => {
    expect(() => extractProjectBlocks('<!-- project: Caro-App -->\nx', 'f')).toThrow(
      /\[f\] invalid project slug: Caro-App/,
    )
    expect(() => extractProjectBlocks('<!-- project: caro_app -->\nx', 'f')).toThrow(/invalid project slug: caro_app/)
  })

  it('rejects a slug with spaces or an empty slug instead of skipping the marker', () => {
    expect(() => extractProjectBlocks('<!-- project: Caro App -->\nx', 'f')).toThrow('[f] invalid project slug: Caro App')
    expect(() => extractProjectBlocks('<!-- project: -->\nx', 'f')).toThrow(/\[f\] invalid project slug: $/)
  })

  it('tolerates spacing and returns empty when no markers', () => {
    expect(extractProjectBlocks('<!--project:x-1-->\nhi', 'f').map((b) => b.slug)).toEqual(['x-1'])
    expect(extractProjectBlocks('<!-- project : b -->\nhi', 'f').map((b) => b.slug)).toEqual(['b'])
    expect(extractProjectBlocks('<!--  project  :  b  -->\nhi', 'f').map((b) => b.slug)).toEqual(['b'])
    expect(extractProjectBlocks('nothing', 'f')).toEqual([])
  })
})
