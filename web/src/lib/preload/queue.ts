import type { PreloadTask, PreloadTier } from './plan'

/** What the queue needs from the browser; injected so the ordering logic is testable without one. */
export type PreloadEnv = {
  /** Fetches one task; settles when it is in the cache (or failed: a failure counts as done, never retried). */
  run(task: PreloadTask): Promise<unknown>
  /** Calls `cb` once the browser is idle; returns a cancel function. */
  whenIdle(cb: () => void): () => void
  /** URLs already preloaded (shared across mounts and, for files, the session). */
  done: { has(key: string): boolean; add(key: string): void }
  /** A data saver / 2g connection: only tier 1 is fetched. */
  constrained?: boolean
  /** Tasks to leave out (e.g. the large PDFs on a slow link, where they would hold up page prefetches). */
  skip?: (task: PreloadTask) => boolean
}

export type PreloadQueue = {
  /** Starts (or continues) working through the tiers. */
  start(): void
  /** Paused: no new task starts (in-flight ones finish). Used while the tab is hidden. */
  setPaused(paused: boolean): void
  /** Navigation intent (hover, focus, touch): fetch this URL now, ahead of the queue. */
  bump(task: PreloadTask): void
  /** Stops for good (unmount): nothing new starts. */
  stop(): void
  /** For tests and the debug log: the tier being worked on (its id), or undefined when finished. */
  readonly tier: number | undefined
}

export const taskKey = (t: PreloadTask) => `${t.kind} ${t.url}`

/**
 * Works through `tiers` in order: a tier starts only when every task of the tier before it has settled. Within a tier
 * at most `concurrency` tasks are in flight; an `idle` tier starts each task from an idle callback. Already-done URLs
 * are skipped, so a re-mount (language switch) or a hover-prefetched page costs nothing.
 */
export function createPreloadQueue(tiers: readonly PreloadTier[], env: PreloadEnv): PreloadQueue {
  const active = (env.constrained ? tiers.slice(0, 1) : tiers).map((t) => ({ ...t, tasks: t.tasks.filter((x) => !env.skip?.(x)) }))
  let index = 0
  let pending: PreloadTask[] = active[0] ? [...active[0].tasks] : []
  let inFlight = 0
  let paused = false
  let stopped = false
  let started = false
  let cancelIdle: (() => void) | undefined

  const settle = () => {
    inFlight--
    pump()
  }

  const launch = (task: PreloadTask) => {
    env.done.add(taskKey(task))
    inFlight++
    let p: Promise<unknown>
    try {
      p = Promise.resolve(env.run(task))
    } catch {
      p = Promise.resolve()
    }
    p.then(settle, settle)
  }

  function pump() {
    if (stopped || paused || !started || cancelIdle) return
    while (index < active.length) {
      const tier = active[index]
      pending = pending.filter((t) => !env.done.has(taskKey(t)))
      if (pending.length === 0) {
        if (inFlight > 0) return
        index++
        pending = index < active.length ? [...active[index].tasks] : []
        continue
      }
      if (inFlight >= tier.concurrency) return
      if (tier.idle) {
        cancelIdle = env.whenIdle(() => {
          cancelIdle = undefined
          if (stopped || paused) return
          const next = pending.find((t) => !env.done.has(taskKey(t)))
          if (next && inFlight < tier.concurrency) launch(next)
          pump()
        })
        return
      }
      launch(pending.shift()!)
    }
  }

  return {
    start() {
      started = true
      pump()
    },
    setPaused(p) {
      paused = p
      if (p) {
        cancelIdle?.()
        cancelIdle = undefined
      } else pump()
    },
    bump(task) {
      if (stopped || env.done.has(taskKey(task))) return
      // Outside the tier's concurrency limit: the visitor is about to open it.
      env.done.add(taskKey(task))
      Promise.resolve()
        .then(() => env.run(task))
        .catch(() => {})
    },
    stop() {
      stopped = true
      cancelIdle?.()
      cancelIdle = undefined
    },
    get tier() {
      return index < active.length ? active[index].id : undefined
    },
  }
}
