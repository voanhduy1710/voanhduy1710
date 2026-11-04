import { describe, expect, it, vi } from 'vitest'
import { isPlainClick, middleClickClose, preventMiddleMouseDown } from '@/components/shell/mouse'

const event = (button: number, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey', boolean>> = {}) => ({
  button,
  ...mods,
  preventDefault: vi.fn(),
})

describe('preventMiddleMouseDown', () => {
  it('prevents the default (autoscroll) for the middle button only', () => {
    for (const [button, prevented] of [
      [0, false],
      [1, true],
      [2, false],
    ] as const) {
      const e = event(button)
      preventMiddleMouseDown(e)
      expect(e.preventDefault).toHaveBeenCalledTimes(prevented ? 1 : 0)
    }
  })
})

describe('middleClickClose', () => {
  it('closes and prevents the default on a middle-button auxclick only', () => {
    for (const [button, closes] of [
      [0, false],
      [1, true],
      [2, false],
    ] as const) {
      const onClose = vi.fn()
      const e = event(button)
      middleClickClose(onClose).onAuxClick(e)
      expect(onClose).toHaveBeenCalledTimes(closes ? 1 : 0)
      expect(e.preventDefault).toHaveBeenCalledTimes(closes ? 1 : 0)
    }
  })

  it('stops autoscroll on middle mousedown without closing', () => {
    const onClose = vi.fn()
    const e = event(1)
    middleClickClose(onClose).onMouseDown(e)
    expect(e.preventDefault).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('isPlainClick', () => {
  it('accepts an unmodified left click only', () => {
    expect(isPlainClick(event(0))).toBe(true)
    expect(isPlainClick(event(1))).toBe(false)
    expect(isPlainClick(event(2))).toBe(false)
    for (const mod of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) {
      expect(isPlainClick(event(0, { [mod]: true }))).toBe(false)
    }
  })
})
