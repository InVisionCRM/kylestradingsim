import { describe, it, expect } from 'vitest'
import { classifyDir, counterparty, transferAmount, tsSeconds, toWalletTrades, priceAtTime } from './walletTrades'
import type { RawTransfer } from '../api/blockscout'
import type { Candle } from '../types'

const WALLET = '0xAbC0000000000000000000000000000000000001'
const OTHER = '0x9990000000000000000000000000000000000009'
const POOL = '0xPool000000000000000000000000000000000aaa'
const pools = new Set([POOL.toLowerCase()])

const xfer = (over: Partial<RawTransfer>): RawTransfer => ({
  timestamp: '2026-05-30T16:20:11.000000Z',
  transaction_hash: '0xtx',
  from: { hash: OTHER },
  to: { hash: WALLET },
  total: { value: '1000000000', decimals: '9' },
  ...over,
})

describe('classifyDir', () => {
  it('token in (to == wallet)', () => expect(classifyDir(xfer({}), WALLET)).toBe('in'))
  it('token out (from == wallet)', () =>
    expect(classifyDir(xfer({ from: { hash: WALLET }, to: { hash: OTHER } }), WALLET)).toBe('out'))
  it('is case-insensitive', () =>
    expect(classifyDir(xfer({ to: { hash: WALLET.toLowerCase() } }), WALLET.toUpperCase())).toBe('in'))
  it('skips self-transfers', () =>
    expect(classifyDir(xfer({ from: { hash: WALLET }, to: { hash: WALLET } }), WALLET)).toBeNull())
  it('skips unrelated transfers', () =>
    expect(classifyDir(xfer({ from: { hash: OTHER }, to: { hash: OTHER } }), WALLET)).toBeNull())
})

describe('counterparty', () => {
  it('is the sender on an in-transfer', () =>
    expect(counterparty(xfer({ from: { hash: POOL } }), 'in')).toBe(POOL.toLowerCase()))
  it('is the recipient on an out-transfer', () =>
    expect(counterparty(xfer({ to: { hash: POOL } }), 'out')).toBe(POOL.toLowerCase()))
})

describe('transferAmount', () => {
  it('converts by decimals', () => {
    expect(transferAmount(xfer({ total: { value: '1500000000', decimals: '9' } }))).toBeCloseTo(1.5, 9)
    expect(transferAmount(xfer({ total: { value: '2500000', decimals: '6' } }))).toBeCloseTo(2.5, 9)
  })
  it('is 0 when total is missing', () => {
    expect(transferAmount(xfer({ total: undefined }))).toBe(0)
  })
})

describe('tsSeconds', () => {
  it('parses ISO to unix seconds', () => {
    expect(tsSeconds('2026-05-30T16:20:11.000000Z')).toBe(Math.floor(Date.parse('2026-05-30T16:20:11Z') / 1000))
  })
  it('is 0 for garbage', () => {
    expect(tsSeconds('not-a-date')).toBe(0)
  })
})

describe('toWalletTrades (pool-aware)', () => {
  it('IN from a pool = buy, OUT to a pool = sell, everything else = transfer', () => {
    const trades = toWalletTrades(
      [
        xfer({ from: { hash: POOL }, to: { hash: WALLET }, timestamp: '2026-05-30T15:00:00Z' }), // buy
        xfer({ from: { hash: WALLET }, to: { hash: POOL }, timestamp: '2026-05-30T16:00:00Z' }), // sell
        xfer({ from: { hash: OTHER }, to: { hash: WALLET }, timestamp: '2026-05-30T17:00:00Z' }), // transfer in
        xfer({ from: { hash: WALLET }, to: { hash: WALLET } }), // self → dropped
        xfer({ total: { value: '0', decimals: '9' } }), // zero → dropped
      ],
      WALLET,
      pools,
    )
    expect(trades.map((t) => t.kind)).toEqual(['buy', 'sell', 'transfer'])
    expect(trades.map((t) => t.dir)).toEqual(['in', 'out', 'in'])
  })
  it('with no known pools, everything is a transfer', () => {
    const trades = toWalletTrades([xfer({ from: { hash: POOL }, to: { hash: WALLET } })], WALLET, new Set())
    expect(trades[0].kind).toBe('transfer')
  })
})

describe('priceAtTime', () => {
  const candles: Candle[] = [
    { time: 100, open: 1, high: 1, low: 1, close: 10, volume: 0 },
    { time: 200, open: 1, high: 1, low: 1, close: 20, volume: 0 },
    { time: 300, open: 1, high: 1, low: 1, close: 30, volume: 0 },
  ]
  it('returns the last candle close at/before ts', () => {
    expect(priceAtTime(candles, 250)).toBe(20)
    expect(priceAtTime(candles, 200)).toBe(20)
  })
  it('clamps to edges outside the window', () => {
    expect(priceAtTime(candles, 50)).toBe(10)
    expect(priceAtTime(candles, 999)).toBe(30)
  })
  it('is null with no candles', () => {
    expect(priceAtTime([], 100)).toBeNull()
  })
})
