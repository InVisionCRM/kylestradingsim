import { describe, it, expect } from 'vitest'
import { impactFraction, executionPrice, MAX_IMPACT } from './slippage'

describe('impactFraction', () => {
  it('is ~0 for a tiny order vs a deep pool', () => {
    expect(impactFraction(500, 4_000_000)).toBeCloseTo(500 / 2_000_000, 8)
  })
  it('scales with order ÷ (pool/2)', () => {
    expect(impactFraction(25_000, 100_000)).toBeCloseTo(0.5, 8) // 25k / (100k/2)
  })
  it('returns 0 with unknown liquidity', () => {
    expect(impactFraction(1000, null)).toBe(0)
    expect(impactFraction(1000, 0)).toBe(0)
  })
  it('caps extreme sizes', () => {
    expect(impactFraction(10_000_000, 1000)).toBe(MAX_IMPACT)
  })
})

describe('executionPrice', () => {
  it('buys fill above mid, sells below, by the impact factor', () => {
    // size = quarter pool → f = 0.5 → buy ×1.5, sell ÷1.5
    expect(executionPrice(2, 25_000, 'buy', 100_000)).toBeCloseTo(3, 6)
    expect(executionPrice(2, 25_000, 'sell', 100_000)).toBeCloseTo(2 / 1.5, 6)
  })
  it('is ~mid for a negligible order', () => {
    expect(executionPrice(2, 100, 'buy', 4_000_000)).toBeCloseTo(2, 3)
  })
  it('returns mid when slippage is off (caller passes null liquidity)', () => {
    expect(executionPrice(2, 1000, 'buy', null)).toBe(2)
    expect(executionPrice(2, 1000, 'sell', null)).toBe(2)
  })
})
