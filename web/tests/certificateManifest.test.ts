import { describe, expect, it } from 'vitest'
import { parseCertificateManifest } from '@/lib/certificateManifest'
import { certificateHref, certificatePdfUrl, isCompleted } from '@/lib/certificates'

describe('certificate manifest and URLs', () => {
  it('parses a JSON array of certificate numbers', () => {
    expect([...parseCertificateManifest('[1, 2, 7]\n')]).toEqual([1, 2, 7])
  })

  it('rejects anything else, naming the file', () => {
    for (const bad of ['{}', '[0]', '["1"]', '[1.5]']) {
      expect(() => parseCertificateManifest(bad)).toThrow('content/certificates.json must be a JSON array of certificate numbers')
    }
  })

  it('builds the page and PDF URLs; only "Completed" (any case/spacing) counts as completed', () => {
    expect(certificateHref('vi', 3)).toBe('/vi/certifications/3')
    expect(certificatePdfUrl(3)).toBe('/content/certificates/3.pdf')
    expect(isCompleted(' completed ')).toBe(true)
    expect(isCompleted('In progress')).toBe(false)
    expect(isCompleted('Đã hoàn thành')).toBe(false)
  })
})
