import { describe, expect, it } from 'vitest'
import type { PreloadTask, PreloadTier } from '@/lib/preload/plan'
import { createPreloadQueue, taskKey, type PreloadEnv } from '@/lib/preload/queue'

const r = (url: string): PreloadTask => ({ kind: 'route', url })
const tier = (id: number, urls: string[], concurrency = 1, idle = false): PreloadTier => ({
  id,
  name: `t${id}`,
  tasks: urls.map(r),
  concurrency,
  idle,
})

/** A fake browser: tasks finish when the test says so; idle callbacks run when the test flushes them. */
function harness(opts: { constrained?: boolean; done?: string[] } = {}) {
  const started: string[] = []
  const finish = new Map<string, () => void>()
  const idle: (() => void)[] = []
  const done = new Set(opts.done ?? [])
  const env: PreloadEnv = {
    run: (t) =>
      new Promise<void>((res) => {
        started.push(t.url)
        finish.set(t.url, res)
      }),
    whenIdle: (cb) => {
      idle.push(cb)
      return () => {
        const i = idle.indexOf(cb)
        if (i >= 0) idle.splice(i, 1)
      }
    },
    done: { has: (k) => done.has(k), add: (k) => void done.add(k) },
    constrained: opts.constrained,
  }
  const tick = () => new Promise((res) => setTimeout(res, 0))
  return {
    env,
    started,
    done,
    inFlight: () => started.filter((u) => finish.has(u)),
    async end(url: string) {
      const f = finish.get(url)
      if (!f) throw new Error(`${url} not started`)
      finish.delete(url)
      f()
      await tick()
    },
    async flushIdle() {
      const cbs = idle.splice(0)
      cbs.forEach((cb) => cb())
      await tick()
    },
    idleCount: () => idle.length,
    tick,
  }
}

const TIERS = [tier(1, ['/en']), tier(2, ['/w1', '/w2', '/w3'], 2), tier(3, ['/bi'], 1, true), tier(4, ['/c1', '/c2'], 1, true)]

describe('createPreloadQueue', () => {
  it('runs the tiers in order: a tier starts only after the previous one has settled', async () => {
    const h = harness()
    const q = createPreloadQueue(TIERS, h.env)
    q.start()
    expect(h.started).toEqual(['/en'])
    expect(q.tier).toBe(1)
    await h.end('/en')
    expect(h.started).toEqual(['/en', '/w1', '/w2'])
    expect(q.tier).toBe(2)
    await h.end('/w1')
    expect(h.started).toEqual(['/en', '/w1', '/w2', '/w3'])
    await h.end('/w3')
    // /w2 still in flight: tier 3 must wait.
    expect(h.idleCount()).toBe(0)
    await h.end('/w2')
    expect(q.tier).toBe(3)
    // Idle tiers start from an idle callback, not right away.
    expect(h.started).not.toContain('/bi')
    await h.flushIdle()
    expect(h.started.at(-1)).toBe('/bi')
    await h.end('/bi')
    await h.flushIdle()
    expect(h.started.at(-1)).toBe('/c1')
    await h.end('/c1')
    await h.flushIdle()
    await h.end('/c2')
    expect(h.started).toEqual(['/en', '/w1', '/w2', '/w3', '/bi', '/c1', '/c2'])
    expect(q.tier).toBeUndefined()
  })

  it('never has more than a tier’s concurrency in flight', async () => {
    const h = harness()
    const q = createPreloadQueue([tier(2, ['/a', '/b', '/c', '/d', '/e'], 2)], h.env)
    q.start()
    let max = h.inFlight().length
    for (const u of ['/a', '/b', '/c', '/d', '/e']) {
      max = Math.max(max, h.inFlight().length)
      await h.end(u)
    }
    expect(max).toBe(2)
    expect(h.started).toEqual(['/a', '/b', '/c', '/d', '/e'])
  })

  it('on a data-saver / 2g connection fetches tier 1 only', async () => {
    const h = harness({ constrained: true })
    const q = createPreloadQueue(TIERS, h.env)
    q.start()
    await h.end('/en')
    await h.flushIdle()
    expect(h.started).toEqual(['/en'])
    expect(q.tier).toBeUndefined()
  })

  it('skips what is already done and marks what it fetches', async () => {
    const h = harness({ done: [taskKey(r('/en')), taskKey(r('/w2'))] })
    const q = createPreloadQueue(TIERS, h.env)
    q.start()
    expect(h.started).toEqual(['/w1', '/w3'])
    expect(h.done.has(taskKey(r('/w1')))).toBe(true)
    // The same URL in a later tier is not fetched again.
    const h2 = harness()
    const q2 = createPreloadQueue([tier(1, ['/x']), tier(2, ['/x', '/y'])], h2.env)
    q2.start()
    await h2.end('/x')
    expect(h2.started).toEqual(['/x', '/y'])
  })

  it('pauses (tab hidden) and resumes where it was', async () => {
    const h = harness()
    const q = createPreloadQueue(TIERS, h.env)
    q.setPaused(true)
    q.start()
    expect(h.started).toEqual([])
    q.setPaused(false)
    expect(h.started).toEqual(['/en'])
    q.setPaused(true)
    await h.end('/en')
    // In-flight work finished, but nothing new started while paused.
    expect(h.started).toEqual(['/en'])
    q.setPaused(false)
    expect(h.started).toEqual(['/en', '/w1', '/w2'])
  })

  it('pausing cancels a pending idle callback', async () => {
    const h = harness()
    const q = createPreloadQueue([tier(3, ['/bi'], 1, true)], h.env)
    q.start()
    expect(h.idleCount()).toBe(1)
    q.setPaused(true)
    expect(h.idleCount()).toBe(0)
    q.setPaused(false)
    await h.flushIdle()
    expect(h.started).toEqual(['/bi'])
  })

  it('bump (hover) fetches a URL at once, ahead of the queue and outside the concurrency limit; once only', async () => {
    const h = harness()
    const q = createPreloadQueue(TIERS, h.env)
    q.start()
    q.bump(r('/c2'))
    q.bump(r('/c2'))
    await h.tick()
    expect(h.started).toEqual(['/en', '/c2'])
    // Later, its tier skips it.
    await h.end('/en')
    for (const u of ['/w1', '/w2']) await h.end(u)
    await h.end('/w3')
    await h.flushIdle()
    await h.end('/bi')
    await h.flushIdle()
    await h.end('/c1')
    await h.flushIdle()
    expect(h.started.filter((u) => u === '/c2')).toHaveLength(1)
    expect(q.tier).toBeUndefined()
  })

  it('a failed task counts as settled; stop() starts nothing new', async () => {
    const started: string[] = []
    const env: PreloadEnv = {
      run: (t) => {
        started.push(t.url)
        return t.url === '/en' ? Promise.reject(new Error('offline')) : new Promise(() => {})
      },
      whenIdle: (cb) => {
        const id = setTimeout(cb, 0)
        return () => clearTimeout(id)
      },
      done: new Set<string>(),
    }
    const q = createPreloadQueue(TIERS, env)
    q.start()
    await new Promise((res) => setTimeout(res, 0))
    expect(started).toEqual(['/en', '/w1', '/w2'])
    q.stop()
    q.bump(r('/zzz'))
    await new Promise((res) => setTimeout(res, 5))
    expect(started).toEqual(['/en', '/w1', '/w2'])
  })

  it('leaves out skipped tasks (PDFs on a slow link) and moves on', async () => {
    const h = harness()
    const tiers: PreloadTier[] = [
      { id: 4, name: 'rest', concurrency: 1, idle: false, tasks: [r('/cv'), { kind: 'document', url: '/1.pdf' }, r('/files/x')] },
    ]
    const q = createPreloadQueue(tiers, { ...h.env, skip: (t) => t.kind === 'document' })
    q.start()
    await h.end('/cv')
    await h.end('/files/x')
    expect(h.started).toEqual(['/cv', '/files/x'])
    expect(q.tier).toBeUndefined()
  })
})
