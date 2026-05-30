import { describe, it, expect } from 'vitest'
import { ema, sma, rsi } from './indicators'

describe('sma', () => {
  it('averages a trailing window, null during warmup', () => {
    expect(sma([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
  })
})

describe('ema', () => {
  it('seeds with SMA then trends with the data', () => {
    const r = ema([1, 2, 3, 4, 5], 2)
    expect(r[0]).toBeNull()
    expect(r[1]).toBeCloseTo(1.5, 6)
    expect(r[4]!).toBeGreaterThan(r[3]!)
  })
})

describe('rsi', () => {
  it('is 100 when every change is a gain', () => {
    const vals = Array.from({ length: 16 }, (_, i) => i + 1)
    expect(rsi(vals, 14)[14]).toBe(100)
  })
  it('stays null until it has enough data', () => {
    expect(rsi([1, 2, 3], 14).every((x) => x === null)).toBe(true)
  })
})
