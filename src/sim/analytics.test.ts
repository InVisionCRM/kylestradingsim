import { describe, it, expect } from 'vitest'
import { computeAnalytics } from './analytics'
import type { Account, Side, Trade } from '../types'

let n = 0
function tr(side: Side, tokenKey: string, symbol: string, qty: number, price: number, ts: number, fee = 0): Trade {
  return { id: `t${n++}`, ts, mode: 'live', tokenKey, symbol, side, qtyToken: qty, priceUsd: price, valueUsd: qty * price, feeUsd: fee }
}
function acct(trades: Trade[], starting = 10000): Account {
  return { startingBalanceUsd: starting, cashUsd: 0, realizedPnlUsd: 0, positions: {}, trades }
}

describe('computeAnalytics', () => {
  it('returns empty analytics with no trades', () => {
    const a = computeAnalytics(acct([]))
    expect(a.hasData).toBe(false)
    expect(a.closed).toHaveLength(0)
    expect(a.realizedPnl).toBe(0)
  })

  it('scores a single winning round trip', () => {
    const a = computeAnalytics(acct([tr('buy', 'sol:WIF', 'WIF', 500, 2, 1), tr('sell', 'sol:WIF', 'WIF', 500, 3, 2)]))
    expect(a.hasData).toBe(true)
    expect(a.realizedPnl).toBeCloseTo(500, 6)
    expect(a.wins).toBe(1)
    expect(a.losses).toBe(0)
    expect(a.winRate).toBe(100)
    expect(a.profitFactor).toBe(Infinity)
    expect(a.maxDrawdown).toBeCloseTo(0, 6)
    expect(a.byToken).toEqual([{ symbol: 'WIF', pnl: 500 }])
    expect(a.curve[a.curve.length - 1].cum).toBeCloseTo(500, 6)
  })

  it('computes win rate, profit factor and drawdown across a win and a loss', () => {
    const a = computeAnalytics(
      acct([
        tr('buy', 'sol:WIF', 'WIF', 500, 2, 1),
        tr('sell', 'sol:WIF', 'WIF', 500, 3, 2), // +500
        tr('buy', 'sol:BONK', 'BONK', 100, 1, 3),
        tr('sell', 'sol:BONK', 'BONK', 100, 0.5, 4), // -50
      ]),
    )
    expect(a.realizedPnl).toBeCloseTo(450, 6)
    expect(a.winRate).toBe(50)
    expect(a.profitFactor).toBeCloseTo(10, 6)
    expect(a.avgWin).toBeCloseTo(500, 6)
    expect(a.avgLoss).toBeCloseTo(-50, 6)
    expect(a.largestWin).toBeCloseTo(500, 6)
    expect(a.largestLoss).toBeCloseTo(-50, 6)
    expect(a.maxDrawdown).toBeCloseTo(-50, 6) // peak 500, then 450
  })

  it('averages entry across two buys before a sell', () => {
    const a = computeAnalytics(
      acct([
        tr('buy', 'sol:X', 'X', 500, 2, 1),
        tr('buy', 'sol:X', 'X', 500, 4, 2), // avg entry now 3
        tr('sell', 'sol:X', 'X', 1000, 3, 3), // breakeven
      ]),
    )
    expect(a.closed[0].avgEntry).toBeCloseTo(3, 6)
    expect(a.realizedPnl).toBeCloseTo(0, 6)
  })

  it('subtracts fees from realized P&L', () => {
    const a = computeAnalytics(acct([tr('buy', 'sol:X', 'X', 100, 1, 1, 0), tr('sell', 'sol:X', 'X', 100, 1, 2, 5)]))
    expect(a.realizedPnl).toBeCloseTo(-5, 6)
    expect(a.totalFees).toBeCloseTo(5, 6)
  })
})
