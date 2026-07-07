import type { WalletSwap } from '../api/pulsex'

/**
 * Quote-side symbols: when one side of a pair is one of these, the OTHER side
 * is the token the wallet is actually trading.
 */
const QUOTES = new Set(['wpls', 'pls', 'dai', 'pdai', 'usdc', 'usdt', 'usdl', 'weth', 'wbtc', 'hexdc'])

export interface WalletTokenPnl {
  tokenAddress: string
  symbol: string
  buys: number
  sells: number
  /** total USD spent buying (within the fetched window) */
  costUsd: number
  /** total USD received selling (only the portion with known cost basis) */
  proceedsUsd: number
  /** proceeds − average cost of the sold quantity */
  realizedUsd: number
  /** realized return on the sold portion's cost */
  roiPct: number
  avgEntryUsd: number
  avgExitUsd: number
  /** tokens still held from these buys (unrealized, not valued here) */
  remainingQty: number
  lastTs: number
}

interface Basis {
  symbol: string
  qty: number
  avgEntry: number
  buys: number
  sells: number
  costUsd: number
  proceedsUsd: number
  realizedUsd: number
  costOfSold: number
  soldQty: number
  lastTs: number
}

/**
 * Average-cost realized P&L per traded token from a wallet's swap history.
 * Sells of tokens acquired BEFORE the fetched window (no cost basis) are
 * skipped rather than counted as pure profit.
 */
export function computeWalletPnl(swaps: WalletSwap[]): WalletTokenPnl[] {
  const byToken = new Map<string, Basis>()

  for (const s of swaps) {
    // pick the traded (non-quote) side; if both or neither are quotes, use token0
    const t0Quote = QUOTES.has(s.token0.symbol.toLowerCase())
    const t1Quote = QUOTES.has(s.token1.symbol.toLowerCase())
    const traded = t0Quote === t1Quote ? 0 : t0Quote ? 1 : 0

    const outAmt = traded === 0 ? s.amount0Out : s.amount1Out
    const inAmt = traded === 0 ? s.amount0In : s.amount1In
    const token = traded === 0 ? s.token0 : s.token1
    const usd = s.amountUSD
    if (!(usd > 0)) continue

    const b =
      byToken.get(token.id) ??
      ({ symbol: token.symbol, qty: 0, avgEntry: 0, buys: 0, sells: 0, costUsd: 0, proceedsUsd: 0, realizedUsd: 0, costOfSold: 0, soldQty: 0, lastTs: 0 } as Basis)

    if (outAmt > 0 && outAmt >= inAmt) {
      // wallet RECEIVED the traded token = buy
      const newQty = b.qty + outAmt
      b.avgEntry = newQty > 0 ? (b.qty * b.avgEntry + usd) / newQty : 0
      b.qty = newQty
      b.costUsd += usd
      b.buys++
    } else if (inAmt > 0) {
      // traded token flowed INTO the pool = sell
      if (b.qty <= 0) continue // no cost basis in window — skip, don't fake profit
      const sellQty = Math.min(inAmt, b.qty)
      const proceeds = usd * (sellQty / inAmt)
      const cost = b.avgEntry * sellQty
      b.realizedUsd += proceeds - cost
      b.proceedsUsd += proceeds
      b.costOfSold += cost
      b.soldQty += sellQty
      b.qty -= sellQty
      b.sells++
    } else {
      continue
    }
    b.lastTs = Math.max(b.lastTs, s.ts)
    byToken.set(token.id, b)
  }

  const out: WalletTokenPnl[] = []
  for (const [tokenAddress, b] of byToken) {
    if (b.sells === 0) continue // nothing realized — nothing to flex
    out.push({
      tokenAddress,
      symbol: b.symbol,
      buys: b.buys,
      sells: b.sells,
      costUsd: b.costUsd,
      proceedsUsd: b.proceedsUsd,
      realizedUsd: b.realizedUsd,
      roiPct: b.costOfSold > 0 ? (b.realizedUsd / b.costOfSold) * 100 : 0,
      avgEntryUsd: b.soldQty > 0 ? b.costOfSold / b.soldQty : 0,
      avgExitUsd: b.soldQty > 0 ? b.proceedsUsd / b.soldQty : 0,
      remainingQty: b.qty,
      lastTs: b.lastTs,
    })
  }
  return out.sort((a, b) => Math.abs(b.realizedUsd) - Math.abs(a.realizedUsd))
}