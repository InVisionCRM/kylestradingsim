import { describe, expect, it } from 'vitest'
import { swapToTape } from './pulsex'

const PAIR = {
  token0: { id: '0xbase00000000000000000000000000000000dead' },
  token1: { id: '0xquote0000000000000000000000000000000beef' },
}

function raw(over: Partial<Parameters<typeof swapToTape>[0]>) {
  return {
    id: '0xabc123-0',
    timestamp: '1783424445',
    amount0In: '0',
    amount1In: '0',
    amount0Out: '0',
    amount1Out: '0',
    amountUSD: '0',
    to: '0xwallet',
    pair: PAIR,
    ...over,
  }
}

describe('swapToTape', () => {
  it('base = token0: base flowing OUT of the pool is a buy, priced from amountUSD', () => {
    const t = swapToTape(raw({ amount1In: '100', amount0Out: '50', amountUSD: '200' }), PAIR.token0.id)
    expect(t).not.toBeNull()
    expect(t!.side).toBe('buy')
    expect(t!.qtyToken).toBe(50)
    expect(t!.priceUsd).toBeCloseTo(4) // $200 / 50 tokens
    expect(t!.valueUsd).toBe(200)
  })

  it('base = token0: base flowing INTO the pool is a sell', () => {
    const t = swapToTape(raw({ amount0In: '80', amount1Out: '100', amountUSD: '160' }), PAIR.token0.id)
    expect(t!.side).toBe('sell')
    expect(t!.qtyToken).toBe(80)
    expect(t!.priceUsd).toBeCloseTo(2)
  })

  it('base = token1: orientation flips', () => {
    const buy = swapToTape(raw({ amount0In: '10', amount1Out: '25', amountUSD: '50' }), PAIR.token1.id)
    expect(buy!.side).toBe('buy')
    expect(buy!.qtyToken).toBe(25)
    const sell = swapToTape(raw({ amount1In: '25', amount0Out: '10', amountUSD: '50' }), PAIR.token1.id)
    expect(sell!.side).toBe('sell')
  })

  it('address matching is case-insensitive', () => {
    const t = swapToTape(raw({ amount0Out: '5', amountUSD: '10' }), PAIR.token0.id.toUpperCase())
    expect(t).not.toBeNull()
  })

  it('rejects swaps for a different token and zero-quantity rows', () => {
    expect(swapToTape(raw({ amount0Out: '5', amountUSD: '10' }), '0xother')).toBeNull()
    expect(swapToTape(raw({ amountUSD: '10' }), PAIR.token0.id)).toBeNull()
  })

  it('extracts the tx hash from the swap id and keeps the wallet', () => {
    const t = swapToTape(raw({ amount0Out: '5', amountUSD: '10' }), PAIR.token0.id)
    expect(t!.txHash).toBe('0xabc123')
    expect(t!.wallet).toBe('0xwallet')
    expect(t!.ts).toBe(1783424445)
  })
})
