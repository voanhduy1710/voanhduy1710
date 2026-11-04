import { describe, expect, it } from 'vitest'
import { ui } from '../../src/lib/i18n/ui'

describe('skills sub-heading', () => {
  it('is "Tech skills" / "Kỹ năng công nghệ"; the section and explorer names stay "Skills"', () => {
    expect(ui('en').skillsMatrix).toBe('Tech skills')
    expect(ui('vi').skillsMatrix).toBe('Kỹ năng công nghệ')
  })
})
