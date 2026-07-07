import { describe, expect, it } from 'vitest'
import { computeWalletPnl } from './walletPnl'
import type { WalletSwap } from '../api/pulsex'

const WPLS = { id: '0xwpls', symbol: 'WPLS' }
const HEX = { id: '0xhex', symbol: 'HEX' }
const MEME = { id: '0xmeme', symbol: 'MEME' }

function swap(over: Partial<WalletSwap>): WalletSwap {
  return {
    ts: 1000,
    amountUSD: 0,
    amount0In: 0,
    amount1In: 0,
    amount0Out: 0,
    amount1Out: 0,
    token0: WPLS,
    token1: HEX,
    ...over,
  }
}

describe('computeWalletPnl', () => {
  it('computes realized P&L and ROI on a buy → sell round trip', () => {
    const res = computeWalletPnl([
      // buy 1000 HEX for $100 (WPLS in, HEX out to wallet)
      swap({ ts: 1, amount0In: 500, amount1Out: 1000, amountUSD: 100 }),
      // sell all 1000 HEX for $250
      swap({ ts: 2, amount1In: 1000, amount0Out: 1200, amountUSD: 250 }),
    ])
    expect(res).toHaveLength(1)
    const hex = res[0]
    expect(hex.symbol).toBe('HEX')
    expect(hex.realizedUsd).toBeCloseTo(150)
    expect(hex.roiPct).toBeCloseTo(150)
    expect(hex.avgEntryUsd).toBeCloseTo(0.1)
    expect(hex.avgExitUsd).toBeCloseTo(0.25)
    expect(hex.remainingQty).toBeCloseTo(0)
  })

  it('uses average cost across multiple buys and tracks a partial sell', () => {
    const res = computeWalletPnl([
      swap({ ts: 1, amount0In: 1, amount1Out: 100, amountUSD: 100 }), // 100 @ $1
      swap({ ts: 2, amount0In: 1, amount1Out: 100, amountUSD: 300 }), // 100 @ $3 → avg $2
      swap({ ts: 3, amount1In: 100, amount0Out: 1, amountUSD: 500 }), // sell 100 @ $5
    ])
    const hex = res[0]
    expect(hex.realizedUsd).toBeCloseTo(300) // 500 − 100×$2
    expect(hex.remainingQty).toBeCloseTo(100)
    expect(hex.roiPct).toBeCloseTo(150)
  })

  it('skips sells with no cost basis in the window instead of counting them as profit', () => {
    const res = computeWalletPnl([swap({ ts: 1, amount1In: 500, amount0Out: 10, amountUSD: 400 })])
    expect(res).toHaveLength(0)
  })

  it('identifies the traded token when the quote is token1', () => {
    const res = computeWalletPnl([
      swap({ token0: MEME, token1: WPLS, ts: 1, amount1In: 10, amount0Out: 1000, amountUSD: 50 }),
      swap({ token0: MEME, token1: WPLS, ts: 2, amount0In: 1000, amount1Out: 30, amountUSD: 150 }),
    ])
    expect(res).toHaveLength(1)
    expect(res[0].symbol).toBe('MEME')
    expect(res[0].realizedUsd).toBeCloseTo(100)
  })

  it('keeps tokens separate and sorts by absolute realized P&L', () => {
    const res = computeWalletPnl([
      swap({ ts: 1, amount0In: 1, amount1Out: 10, amountUSD: 10 }),
      swap({ ts: 2, amount1In: 10, amount0Out: 1, amountUSD: 15 }), // HEX +5
      swap({ token0: MEME, token1: WPLS, ts: 3, amount1In: 1, amount0Out: 10, amountUSD: 100 }),
      swap({ token0: MEME, token1: WPLS, ts: 4, amount0In: 10, amount1Out: 1, amountUSD: 20 }), // MEME −80
    ])
    expect(res.map((r) => r.symbol)).toEqual(['MEME', 'HEX'])
    expect(res[0].realizedUsd).toBeCloseTo(-80)
  })
})