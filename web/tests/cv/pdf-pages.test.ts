import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { pdfPageCount } from '@/lib/cv/pdfPages'

const pdf = (body: string | Buffer[]) => Buffer.concat([Buffer.from('%PDF-1.4\n'), ...(typeof body === 'string' ? [Buffer.from(body)] : body)])

describe('pdfPageCount (the one-A4-page CV rule of check:cv and export_cv.ps1)', () => {
  it('counts plain page objects, not the page tree (Chrome print-to-PDF)', () => {
    const one = pdf('1 0 obj\n<</Type /Pages /Count 1 /Kids [2 0 R]>>\nendobj\n2 0 obj\n<</Type /Page /Parent 1 0 R>>\nendobj\n')
    const two = pdf('1 0 obj <</Type/Pages/Count 2>> endobj 2 0 obj <</Type/Page>> endobj 3 0 obj <</Type /Page/Parent 1 0 R>> endobj')
    expect(pdfPageCount(one)).toBe(1)
    expect(pdfPageCount(two)).toBe(2)
  })

  it('counts page objects inside Flate-compressed object streams (Word / Acrobat PDFs)', () => {
    const packed = deflateSync(Buffer.from('2 0 3 20 <</Type /Page /Parent 1 0 R>> <</Type/Page>>'))
    const file = pdf([
      Buffer.from(`1 0 obj\n<</Type /Pages /Count 2>>\nendobj\n4 0 obj\n<</Type /ObjStm /N 2 /First 8 /Filter /FlateDecode /Length ${packed.length}>>stream\r\n`),
      packed,
      Buffer.from('\r\nendstream\nendobj\n'),
    ])
    expect(pdfPageCount(file)).toBe(2)
  })

  it('refuses a file that is not a PDF', () => {
    expect(() => pdfPageCount(Buffer.from('<html>'))).toThrow('not a PDF')
  })

  it('the published CVs in the repo root are one page each', () => {
    for (const name of ['CV_Vo Anh Duy_EN.pdf', 'CV_Vo Anh Duy_VN.pdf']) {
      const file = join(process.cwd(), '..', name)
      if (existsSync(file)) expect(pdfPageCount(readFileSync(file)), name).toBe(1)
    }
  })
})
