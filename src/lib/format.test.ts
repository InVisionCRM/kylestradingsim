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

import { priceToInput } from './format'

describe('priceToInput', () => {
  it('formats normal prices with up to 4 decimals, no trailing zeros', () => {
    expect(priceToInput(2.1432)).toBe('2.1432')
    expect(priceToInput(2.5)).toBe('2.5')
    expect(priceToInput(150)).toBe('150')
  })
  it('keeps 5 significant digits for sub-penny prices without scientific notation', () => {
    expect(priceToInput(0.00002311)).toBe('0.00002311')
    expect(priceToInput(0.00002311456)).toBe('0.000023115')
    expect(priceToInput(0.000000019)).toBe('0.000000019')
  })
  it('returns empty for missing or non-positive values', () => {
    expect(priceToInput(null)).toBe('')
    expect(priceToInput(0)).toBe('')
    expect(priceToInput(-3)).toBe('')
  })
})

import { formatAge, shortAddr } from './format'

describe('formatAge', () => {
  const now = Date.now()
  it('formats years and months', () => {
    expect(formatAge(now - (2 * 365 + 8 * 30 + 26) * 86400000)).toBe('2y 8mo')
    expect(formatAge(now - 365 * 86400000)).toBe('1y')
  })
  it('formats months, days and hours', () => {
    expect(formatAge(now - (2 * 30 + 5) * 86400000)).toBe('2mo 5d')
    expect(formatAge(now - (3 * 86400000 + 4 * 3600000))).toBe('3d 4h')
    expect(formatAge(now - 2 * 3600000)).toBe('2h')
    expect(formatAge(now - 5 * 60000)).toBe('5m')
    expect(formatAge(now - 1000)).toBe('now')
  })
  it('handles missing values', () => {
    expect(formatAge(null)).toBe('—')
    expect(formatAge(0)).toBe('—')
  })
})

describe('shortAddr', () => {
  it('shortens long addresses and passes through short ones', () => {
    expect(shortAddr('0xb5bc84f9b6d0373642d586b81979b067572f292e')).toBe('0xb5bc…292e')
    expect(shortAddr('0xabc')).toBe('0xabc')
    expect(shortAddr(null)).toBe('—')
  })
})
