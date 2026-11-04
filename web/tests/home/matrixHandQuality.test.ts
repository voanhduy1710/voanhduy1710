import { describe, expect, it } from 'vitest'
import {
  DRAW_BUDGET_MS,
  STEP_UP_SHARE,
  FRAME_MS,
  HAND_QUALITY,
  initialHandQuality,
  median,
  nextHandQuality,
  STREAMS_PER_COLUMN,
} from '@/components/home/matrixHandGeometry'

describe('matrix hand adaptive quality', () => {
  it('level 0 is the owner’s look; then 15 fps; then 8 streams', () => {
    expect(HAND_QUALITY).toEqual([
      { frameMs: FRAME_MS, streams: STREAMS_PER_COLUMN },
      { frameMs: 1000 / 15, streams: STREAMS_PER_COLUMN },
      { frameMs: 1000 / 15, streams: 8 },
    ])
    expect(STREAMS_PER_COLUMN).toBe(12)
    expect(Math.round(1000 / FRAME_MS)).toBe(30)
  })

  it('starts at 15 fps on weak devices (≤ 4 cores or ≤ 4 GB), else full quality', () => {
    expect(initialHandQuality({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe(0)
    expect(initialHandQuality({})).toBe(0)
    expect(initialHandQuality({ hardwareConcurrency: 4 })).toBe(1)
    expect(initialHandQuality({ hardwareConcurrency: 16, deviceMemory: 4 })).toBe(1)
    expect(initialHandQuality({ hardwareConcurrency: 0 })).toBe(0)
  })

  it('steps down one level when the median draw is over budget; never below the last level', () => {
    expect(nextHandQuality(0, DRAW_BUDGET_MS + 4)).toBe(1)
    expect(nextHandQuality(1, DRAW_BUDGET_MS + 4)).toBe(2)
    expect(nextHandQuality(2, 50)).toBe(2)
    // A ~5 ms draw at full quality is within budget: the owner's look stays.
    expect(nextHandQuality(0, 5)).toBe(0)
  })

  it('steps up only when the predicted draw at the higher level is clearly under budget (no flip-flop)', () => {
    const up = DRAW_BUDGET_MS * STEP_UP_SHARE
    // 15 fps -> 30 fps: same cost per draw.
    expect(nextHandQuality(1, up - 0.5)).toBe(0)
    expect(nextHandQuality(1, up + 0.5)).toBe(1)
    // 8 -> 12 streams: cost scaled by 12/8.
    expect(nextHandQuality(2, (up / 1.5) - 0.2)).toBe(1)
    expect(nextHandQuality(2, (up / 1.5) + 0.2)).toBe(2)
    // After stepping down from 6.5 ms at 12 streams to ~5 ms at 8 streams, it stays at 8.
    expect(nextHandQuality(2, 5)).toBe(2)
  })

  it('median', () => {
    expect(median([])).toBe(0)
    expect(median([5, 1, 9])).toBe(5)
    expect(median([1, 2, 30, 40])).toBe(16)
  })
})
