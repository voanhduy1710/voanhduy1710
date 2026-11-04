/**
 * File-system helpers for the content sync's last step, for Windows:
 *   - `renameWithRetry`: a folder rename that a running dev server, the indexer or antivirus is holding
 *     (EPERM / EBUSY / EACCES) is retried a few times with a growing delay;
 *   - `updateInPlace`: the fallback when the folder still cannot be swapped: copy the staged files over the live ones
 *     and delete the live files that are no longer staged (not atomic, so the caller warns);
 *   - `withSyncLock`: a lock file so two syncs (e.g. `npm run dev` and `npm run build`) never write at once.
 */
import { randomBytes } from 'node:crypto'
import { copyFile, link, mkdir, readdir, readFile, rename, rm, stat, unlink, utimes, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

export const LOCKED_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])

export function isLockedError(e: unknown): boolean {
  return LOCKED_CODES.has((e as NodeJS.ErrnoException)?.code ?? '')
}

export type FsHooks = {
  /** Injectable so tests can simulate a folder Windows refuses to rename. */
  renameImpl?: typeof rename
  /** Delay before retry n (1-based); default 200 ms x n. */
  retryDelayMs?: (attempt: number) => number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Renames, retrying up to `attempts` times in all while the error is EPERM / EBUSY / EACCES. */
export async function renameWithRetry(from: string, to: string, hooks: FsHooks = {}, attempts = 5): Promise<void> {
  const doRename = hooks.renameImpl ?? rename
  const delay = hooks.retryDelayMs ?? ((n: number) => 200 * n)
  for (let n = 1; ; n++) {
    try {
      return await doRename(from, to)
    } catch (e) {
      if (!isLockedError(e) || n >= attempts) throw e
      await sleep(delay(n))
    }
  }
}

async function listFiles(dir: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
  const out: string[] = []
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await listFiles(p)))
    else out.push(p)
  }
  return out
}

/**
 * Makes `live` hold exactly the files of `staged`: copies every staged file over (creating folders), then deletes
 * live files that are not staged and the folders left empty. Returns the live files it could not delete.
 */
export async function updateInPlace(staged: string, live: string): Promise<string[]> {
  const stagedFiles = (await listFiles(staged)).map((f) => relative(staged, f))
  for (const rel of stagedFiles) {
    await mkdir(dirname(join(live, rel)), { recursive: true })
    await copyFile(join(staged, rel), join(live, rel))
  }
  const keep = new Set(stagedFiles.map((r) => r.toLowerCase()))
  const leftovers: string[] = []
  for (const file of await listFiles(live)) {
    const rel = relative(live, file)
    if (keep.has(rel.toLowerCase())) continue
    try {
      await unlink(file)
    } catch {
      leftovers.push(rel)
    }
  }
  await removeEmptyDirs(live)
  return leftovers
}

async function removeEmptyDirs(dir: string, isRoot = true): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const e of entries) if (e.isDirectory()) await removeEmptyDirs(join(dir, e.name), false)
  if (!isRoot && (await readdir(dir).catch(() => ['?'])).length === 0) await rm(dir, { recursive: true }).catch(() => {})
}

export const SYNC_LOCK = '.sync-lock'

/** The fs calls the lock uses; injectable so tests can script races. */
export type LockFs = {
  writeFile: (path: string, data: string, opts: { flag: string }) => Promise<void>
  readFile: (path: string) => Promise<string>
  stat: (path: string) => Promise<{ mtimeMs: number }>
  rename: (from: string, to: string) => Promise<void>
  link: (existing: string, to: string) => Promise<void>
  unlink: (path: string) => Promise<void>
  utimes: (path: string, atime: Date, mtime: Date) => Promise<void>
}

const realLockFs: LockFs = {
  writeFile: (p, d, o) => writeFile(p, d, o),
  readFile: (p) => readFile(p, 'utf8'),
  stat: (p) => stat(p),
  rename: (a, b) => rename(a, b),
  link: (a, b) => link(a, b),
  unlink: (p) => unlink(p),
  utimes: (p, a, m) => utimes(p, a, m),
}

export type LockOptions = {
  timeoutMs?: number
  pollMs?: number
  /** How often the holder refreshes the lock's mtime so a long sync is never taken over (default 30 s). */
  heartbeatMs?: number
  fs?: Partial<LockFs>
  isAlive?: (pid: number) => boolean
}

const STALE_AGE_MS = 10 * 60_000

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

type LockBody = { pid?: number; token?: string }

function parseBody(text: string): LockBody | undefined {
  try {
    const b = JSON.parse(text) as LockBody
    return b && typeof b === 'object' ? b : undefined
  } catch {
    return undefined
  }
}

/**
 * Takes over a stale lock: renames it (atomic, so only one process wins) to a unique name, checks that what it moved
 * is the stale lock it judged (not a fresh one another process created in between; if it is, links it back), then
 * deletes it. Returns true when the caller should retry creating its own lock at once.
 */
async function takeOverIfStale(lock: string, f: LockFs, alive: (pid: number) => boolean, token: string): Promise<boolean> {
  let text = ''
  try {
    text = await f.readFile(lock)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return true // released meanwhile: just retry
  }
  const body = parseBody(text)
  let stale: boolean
  try {
    const age = Date.now() - (await f.stat(lock)).mtimeMs
    // Unreadable / half-written files are only stale once old (they may be being written right now).
    stale = body ? age > STALE_AGE_MS || typeof body.pid !== 'number' || !alive(body.pid) : age > 5_000
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'ENOENT'
  }
  if (!stale) return false
  const moved = `${lock}.stale-${process.pid}-${token}`
  try {
    await f.rename(lock, moved)
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'ENOENT' // someone else took it over first
  }
  const movedText = await f.readFile(moved).catch(() => text)
  if (movedText !== text) {
    // We moved a fresh lock that replaced the stale one: give it back (link fails if the name is taken again).
    await f.link(moved, lock).catch(() => {})
  }
  await f.unlink(moved).catch(() => {})
  return movedText === text
}

/**
 * Runs `fn` holding `<dir>/.sync-lock`. Another sync waits for the lock (polling) up to `timeoutMs`, then fails
 * naming the lock file; a stale lock (its process is gone, or its mtime is over 10 min old) is taken over. While
 * held, the lock's mtime is refreshed every 30 s. On release the file is only deleted if it still holds our pid and
 * token, so a lock that someone else took over is never removed by us.
 */
export async function withSyncLock<T>(dir: string, fn: () => Promise<T>, opts: LockOptions = {}): Promise<T> {
  const f: LockFs = { ...realLockFs, ...opts.fs }
  const alive = opts.isAlive ?? processAlive
  const lock = join(dir, SYNC_LOCK)
  const timeoutMs = opts.timeoutMs ?? 30_000
  const pollMs = opts.pollMs ?? 250
  const deadline = Date.now() + timeoutMs
  const token = randomBytes(8).toString('hex')
  const mine = JSON.stringify({ pid: process.pid, token, at: new Date().toISOString() })
  await mkdir(dir, { recursive: true })
  for (;;) {
    try {
      await f.writeFile(lock, mine, { flag: 'wx' })
      break
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
      if (await takeOverIfStale(lock, f, alive, token)) continue
      if (Date.now() >= deadline) {
        throw new Error(
          `Another content sync is running (lock file ${lock}); waited ${Math.round(timeoutMs / 1000)} s. ` +
            'If no sync is running, delete that file and retry.',
        )
      }
      await sleep(pollMs)
    }
  }
  const beat = setInterval(() => {
    const now = new Date()
    f.utimes(lock, now, now).catch(() => {})
  }, opts.heartbeatMs ?? 30_000)
  beat.unref()
  try {
    return await fn()
  } finally {
    clearInterval(beat)
    try {
      const body = parseBody(await f.readFile(lock))
      if (body?.pid === process.pid && body.token === token) await f.unlink(lock)
    } catch {
      // already gone, or not readable: nothing of ours to remove
    }
  }
}
