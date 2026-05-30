import type { Side } from '../types'

/** Max slippage fraction applied to a fill (keeps degenerate sizes sane). */
export const MAX_IMPACT = 0.95

/**
 * Constant-product (x·y=k) price impact: a pool's liquidity sits ~50/50, so one
 * side ≈ liquidity/2. A trade of `sizeUsd` moves the average price by sizeUsd/(L/2).
 */
export function impactFraction(sizeUsd: number, liquidityUsd: number | null | undefined): number {
  if (!liquidityUsd || liquidityUsd <= 0 || !(sizeUsd > 0)) return 0
  return Math.min(sizeUsd / (liquidityUsd / 2), MAX_IMPACT)
}

/** Average execution price after slippage. Buys fill higher, sells fill lower. */
export function executionPrice(mid: number, sizeUsd: number, side: Side, liquidityUsd: number | null | undefined): number {
  if (!(mid > 0)) return mid
  const f = impactFraction(sizeUsd, liquidityUsd)
  return side === 'buy' ? mid * (1 + f) : mid / (1 + f)
}
