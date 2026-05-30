import { describe, it, expect } from 'vitest'
import { formatPrice, formatPct, formatCompactUsd, formatQty, formatUsd } from './format'

describe('formatPrice', () => {
  it('handles normal prices', () => {
    expect(formatPrice(2.4193)).toBe('2.4193')
    expect(formatPrice(0.842)).toBe('0.8420')
  })
  it('compacts sub-penny memecoin prices with subscript zeros', () => {
    expect(formatPrice(0.00002413)).toBe('0.0₄2413')
    expect(formatPrice(0.000001129)).toBe('0.0₅1129')
  })
  it('handles null / zero', () => {
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(0)).toBe('0')
  })
})

describe('formatPct', () => {
  it('signs values with a unicode minus for negatives', () => {
    expect(formatPct(6.42)).toBe('+6.42%')
    expect(formatPct(-3.1)).toBe('−3.10%')
  })
})

describe('formatCompactUsd', () => {
  it('compacts large dollar figures', () => {
    expect(formatCompactUsd(2_410_000_000)).toBe('$2.41B')
    expect(formatCompactUsd(312_000_000)).toBe('$312.00M')
    expect(formatCompactUsd(4200)).toBe('$4.2K')
  })
})

describe('formatQty', () => {
  it('compacts huge token balances', () => {
    expect(formatQty(41_200_000)).toBe('41.20M')
    expect(formatQty(540)).toBe('540.00')
  })
})

describe('formatUsd', () => {
  it('formats with cents', () => {
    expect(formatUsd(12847.2)).toBe('$12,847.20')
  })
})
