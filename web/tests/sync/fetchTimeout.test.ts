import { afterEach, describe, expect, it, vi } from 'vitest'
import { FETCH_TIMEOUT_MS, firstWorking, type Source } from '../../scripts/sync-certificates'

afterEach(() => vi.restoreAllMocks())

describe('fetch timeout', () => {
  it('is 30 s', () => {
    expect(FETCH_TIMEOUT_MS).toBe(30_000)
  })

  it('a source that stalls is abandoned when its timeout fires and the next source is tried', async () => {
    // Stand-in for AbortSignal.timeout: a signal this test fires by hand, as the real timer would after 30 s.
    const controllers: AbortController[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const c = new AbortController()
      controllers.push(c)
      return c.signal
    })
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('stalls')) {
        // Never answers until aborted (like a hung connection).
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation timed out.', 'TimeoutError')))
        })
      }
      return new Response('ok')
    }) as typeof fetch
    const read = (r: Response) => r.text()
    const sources: Source<string>[] = [
      { label: 'first', url: 'https://example.test/stalls', headers: {}, read },
      { label: 'second', url: 'https://example.test/works', headers: {}, read },
    ]
    const result = firstWorking(fetchImpl, 'a file', sources)
    await vi.waitFor(() => expect(controllers.length).toBe(1))
    controllers[0].abort()
    await expect(result).resolves.toBe('ok')
    expect(AbortSignal.timeout).toHaveBeenCalledWith(30_000)
  })
})
