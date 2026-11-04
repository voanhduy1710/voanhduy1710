import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { config, proxy } from '@/proxy'

const get = (url: string, headers: Record<string, string> = {}) => proxy(new NextRequest(url, { headers }))

describe('proxy (bare /)', () => {
  it('redirects / to the picked language, temporarily and uncached', () => {
    const res = get('https://voanhduy1710.vercel.app/', { 'accept-language': 'vi-VN,vi;q=0.9' })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://voanhduy1710.vercel.app/vi')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(config.matcher).toEqual(['/'])
  })

  it('keeps the query string', () => {
    const res = get('https://voanhduy1710.vercel.app/?utm_source=linkedin&x=1%202')
    expect(res.headers.get('location')).toBe('https://voanhduy1710.vercel.app/en?utm_source=linkedin&x=1%202')
  })

  it('without a query string adds none', () => {
    expect(get('http://localhost:3012/').headers.get('location')).toBe('http://localhost:3012/en')
  })
})
