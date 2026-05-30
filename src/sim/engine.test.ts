import { describe, it, expect } from 'vitest'
import { newAccount, applyBuy, applySell, accountEquity, unrealizedPnl } from './engine'
import { InsufficientFundsError, OversellError } from './errors'
import type { BuyInput, SellInput } from './engine'

const buy = (over: Partial<BuyInput> = {}): BuyInput => ({
  tokenKey: 'solana:POOL',
  chainId: 'solana',
  pairAddress: 'POOL',
  symbol: 'WIF',
  imageUrl: null,
  priceUsd: 2,
  usdAmount: 1000,
  feeBps: 0,
  mode: 'live',
  ts: 1,
  ...over,
})
const sell = (over: Partial<SellInput> = {}): SellInput => ({
  tokenKey: 'solana:POOL',
  priceUsd: 3,
  qtyToken: 500,
  feeBps: 0,
  mode: 'live',
  ts: 2,
  ...over,
})

describe('applyBuy', () => {
  it('debits cash + fee and opens a position with correct avg entry', () => {
    const a = applyBuy(newAccount(10000), buy({ feeBps: 30 }))
    expect(a.cashUsd).toBeCloseTo(10000 - 1000 - 3, 6) // 0.3% fee = $3
    const pos = a.positions['solana:POOL']
    expect(pos.qty).toBeCloseTo(500, 6) // $1000 / $2
    expect(pos.avgEntryUsd).toBeCloseTo(2, 6)
    expect(a.trades).toHaveLength(1)
  })

  it('averages entry across two buys', () => {
    let a = applyBuy(newAccount(10000), buy({ priceUsd: 2, usdAmount: 1000 })) // 500 @ 2
    a = applyBuy(a, buy({ priceUsd: 4, usdAmount: 1000, ts: 2 })) // 250 @ 4
    const pos = a.positions['solana:POOL']
    expect(pos.qty).toBeCloseTo(750, 6)
    expect(pos.avgEntryUsd).toBeCloseTo(2000 / 750, 6)
  })

  it('throws when cash is insufficient', () => {
    expect(() => applyBuy(newAccount(500), buy({ usdAmount: 1000 }))).toThrow(InsufficientFundsError)
  })
})

describe('applySell', () => {
  it('realizes P&L, reduces qty, credits cash', () => {
    const bought = applyBuy(newAccount(10000), buy()) // 500 @ 2, cash 9000
    const a = applySell(bought, sell({ priceUsd: 3, qtyToken: 250 })) // sell 250 @ 3
    expect(a.positions['solana:POOL'].qty).toBeCloseTo(250, 6)
    expect(a.realizedPnlUsd).toBeCloseTo((3 - 2) * 250, 6) // +250
    expect(a.cashUsd).toBeCloseTo(9000 + 750, 6)
  })

  it('removes the position when fully sold', () => {
    const bought = applyBuy(newAccount(10000), buy())
    const a = applySell(bought, sell({ qtyToken: 500 }))
    expect(a.positions['solana:POOL']).toBeUndefined()
  })

  it('throws on oversell', () => {
    const bought = applyBuy(newAccount(10000), buy())
    expect(() => applySell(bought, sell({ qtyToken: 600 }))).toThrow(OversellError)
  })
})

describe('accountEquity / unrealizedPnl', () => {
  it('equity = cash + live position value', () => {
    const a = applyBuy(newAccount(10000), buy()) // cash 9000, 500 tokens
    expect(accountEquity(a, () => 3)).toBeCloseTo(9000 + 1500, 6) // 500 @ 3
    expect(unrealizedPnl(a.positions['solana:POOL'], 3)).toBeCloseTo(500, 6)
  })
  it('falls back to cost basis when no price is known', () => {
    const a = applyBuy(newAccount(10000), buy())
    expect(accountEquity(a, () => null)).toBeCloseTo(10000, 6)
  })
})
