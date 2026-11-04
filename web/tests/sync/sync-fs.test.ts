import { existsSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs'
import { mkdtemp, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renameWithRetry, SYNC_LOCK, updateInPlace, withSyncLock } from '../../scripts/sync-fs'

const temps: string[] = []
afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => rm(d, { recursive: true, force: true })))
})
async function tempDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'sync-fs-'))
  temps.push(d)
  return d
}
function put(root: string, rel: string, data: string): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), data)
}
function tree(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tree(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  )
}
const locked = (code = 'EPERM') => Object.assign(new Error(`${code}: operation not permitted, rename`), { code })

describe('renameWithRetry', () => {
  it('retries EPERM / EBUSY / EACCES with a growing delay, then succeeds', async () => {
    const d = await tempDir()
    put(d, 'a/x.txt', 'x')
    let calls = 0
    const renameImpl = (async (from: string, to: string) => {
      calls++
      if (calls === 1) throw locked('EPERM')
      if (calls === 2) throw locked('EBUSY')
      if (calls === 3) throw locked('EACCES')
      return rename(from, to)
    }) as typeof rename
    const delays: number[] = []
    await renameWithRetry(join(d, 'a'), join(d, 'b'), { renameImpl, retryDelayMs: (n) => (delays.push(n), 0) })
    expect(calls).toBe(4)
    expect(delays).toEqual([1, 2, 3])
    expect(readFileSync(join(d, 'b/x.txt'), 'utf8')).toBe('x')
  })

  it('gives up after 5 attempts; other errors are not retried', async () => {
    let calls = 0
    const always = (async () => {
      calls++
      throw locked()
    }) as unknown as typeof rename
    await expect(renameWithRetry('a', 'b', { renameImpl: always, retryDelayMs: () => 0 })).rejects.toThrow(/EPERM/)
    expect(calls).toBe(5)
    calls = 0
    const missing = (async () => {
      calls++
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    }) as unknown as typeof rename
    await expect(renameWithRetry('a', 'b', { renameImpl: missing, retryDelayMs: () => 0 })).rejects.toThrow(/ENOENT/)
    expect(calls).toBe(1)
  })
})

describe('updateInPlace', () => {
  it('copies staged files over the live ones and deletes live files no longer staged', async () => {
    const d = await tempDir()
    put(d, 'staged/a.txt', 'new a')
    put(d, 'staged/sub/b.txt', 'new b')
    put(d, 'live/a.txt', 'old a')
    put(d, 'live/gone.txt', 'old')
    put(d, 'live/old-dir/c.txt', 'old c')
    expect(await updateInPlace(join(d, 'staged'), join(d, 'live'))).toEqual([])
    expect(tree(join(d, 'live')).sort()).toEqual(['a.txt', 'sub/b.txt'])
    expect(readFileSync(join(d, 'live/a.txt'), 'utf8')).toBe('new a')
  })

  it('creates the live dir when it does not exist yet', async () => {
    const d = await tempDir()
    put(d, 'staged/a.txt', 'a')
    await updateInPlace(join(d, 'staged'), join(d, 'live'))
    expect(tree(join(d, 'live'))).toEqual(['a.txt'])
  })
})

describe('withSyncLock', () => {
  it('holds .sync-lock while running and removes it afterwards, also on failure', async () => {
    const d = await tempDir()
    await withSyncLock(d, async () => {
      expect(JSON.parse(readFileSync(join(d, SYNC_LOCK), 'utf8')).pid).toBe(process.pid)
    })
    expect(existsSync(join(d, SYNC_LOCK))).toBe(false)
    await expect(withSyncLock(d, async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(existsSync(join(d, SYNC_LOCK))).toBe(false)
  })

  it('a second sync waits for the first one', async () => {
    const d = await tempDir()
    const order: string[] = []
    let release!: () => void
    const first = withSyncLock(d, () => new Promise<void>((r) => (release = () => (order.push('first done'), r()))))
    await vi.waitFor(() => expect(existsSync(join(d, SYNC_LOCK))).toBe(true))
    const second = withSyncLock(d, async () => void order.push('second ran'), { pollMs: 10 })
    await new Promise((r) => setTimeout(r, 50))
    expect(order).toEqual([])
    release()
    await Promise.all([first, second])
    expect(order).toEqual(['first done', 'second ran'])
  })

  it('fails with a clear message when the lock is held longer than the timeout', async () => {
    const d = await tempDir()
    // A lock held by this (running) process: not stale.
    put(d, SYNC_LOCK, JSON.stringify({ pid: process.pid }))
    await expect(withSyncLock(d, async () => 'never', { timeoutMs: 100, pollMs: 20 })).rejects.toThrow(
      /Another content sync is running \(lock file .*\.sync-lock\); waited 0 s\. If no sync is running, delete that file/,
    )
    expect(existsSync(join(d, SYNC_LOCK))).toBe(true)
  })

  it('takes over a stale lock whose process is gone', async () => {
    const d = await tempDir()
    put(d, SYNC_LOCK, JSON.stringify({ pid: 2 ** 22 + 12345 }))
    expect(await withSyncLock(d, async () => 'ran', { timeoutMs: 100 })).toBe('ran')
  })

  it('a stale takeover renames the old lock away and gives back a fresh lock that replaced it in between', async () => {
    const d = await tempDir()
    const lock = join(d, SYNC_LOCK)
    put(d, SYNC_LOCK, JSON.stringify({ pid: 2 ** 22 + 1, token: 'old' }))
    const fresh = JSON.stringify({ pid: process.pid, token: 'fresh-other-process' })
    let swapped = false
    // Just before our rename, another process takes the stale lock over and creates its own fresh one.
    const fs = {
      rename: async (a: string, b: string) => {
        if (!swapped) {
          swapped = true
          writeFileSync(lock, fresh)
        }
        return rename(a, b)
      },
    }
    await expect(
      withSyncLock(d, async () => 'never', { timeoutMs: 100, pollMs: 20, fs, isAlive: (pid) => pid === process.pid }),
    ).rejects.toThrow(/Another content sync is running/)
    expect(readFileSync(lock, 'utf8')).toBe(fresh)
    expect(readdirSync(d).filter((n) => n.includes('.stale-'))).toEqual([])
  })

  it('only deletes the lock on release if it still holds our pid and token', async () => {
    const d = await tempDir()
    const lock = join(d, SYNC_LOCK)
    const other = JSON.stringify({ pid: process.pid, token: 'someone-else' })
    await withSyncLock(d, async () => {
      writeFileSync(lock, other) // our lock was taken over while we ran
    })
    expect(readFileSync(lock, 'utf8')).toBe(other)
  })

  it('refreshes the lock mtime while held, so a long sync is not taken over', async () => {
    const d = await tempDir()
    const touched: string[] = []
    const utimes = async (p: string) => void touched.push(p)
    await withSyncLock(d, () => new Promise<void>((r) => setTimeout(r, 150)), { heartbeatMs: 20, fs: { utimes } })
    expect(touched.length).toBeGreaterThanOrEqual(3)
    expect(touched.every((p) => p === join(d, SYNC_LOCK))).toBe(true)
  })

  it('treats a lock whose mtime is over 10 minutes old as stale even if its pid is alive', async () => {
    const d = await tempDir()
    put(d, SYNC_LOCK, JSON.stringify({ pid: process.pid, token: 'x' }))
    const old = new Date(Date.now() - 11 * 60_000)
    utimesSync(join(d, SYNC_LOCK), old, old)
    expect(await withSyncLock(d, async () => 'ran', { timeoutMs: 100 })).toBe('ran')
  })
})
