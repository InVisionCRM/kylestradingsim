import type { Account } from '../types'

export interface ClosedTrade {
  ts: number
  tokenKey: string
  symbol: string
  qty: number
  avgEntry: number
  exit: number
  pnlUsd: number
  returnPct: number
  feeUsd: number
  holdSec: number
}

export interface CurvePoint {
  ts: number
  cum: number
}

export interface Analytics {
  hasData: boolean
  closed: ClosedTrade[] // newest first (for the table)
  realizedPnl: number
  realizedPct: number
  totalFees: number
  buyCount: number
  sellCount: number
  wins: number
  losses: number
  winRate: number // 0..100
  avgWin: number
  avgLoss: number // <= 0
  profitFactor: number // can be Infinity
  largestWin: number
  largestLoss: number
  maxDrawdown: number // <= 0 (USD)
  maxDrawdownPct: number // <= 0
  avgHoldSec: number
  curve: CurvePoint[]
  byToken: { symbol: string; pnl: number }[]
  startingBalance: number
}

const EMPTY = (startingBalance: number): Analytics => ({
  hasData: false,
  closed: [],
  realizedPnl: 0,
  realizedPct: 0,
  totalFees: 0,
  buyCount: 0,
  sellCount: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  avgWin: 0,
  avgLoss: 0,
  profitFactor: 0,
  largestWin: 0,
  largestLoss: 0,
  maxDrawdown: 0,
  maxDrawdownPct: 0,
  avgHoldSec: 0,
  curve: [],
  byToken: [],
  startingBalance,
})

/**
 * Reconstructs round-trip realized P&L from an account's trade list (replaying
 * buys/sells per token) and derives the full performance stat set.
 */
export function computeAnalytics(account: Account): Analytics {
  const startingBalance = account.startingBalanceUsd
  if (!account.trades.length) return EMPTY(startingBalance)

  const trades = [...account.trades].sort((a, b) => a.ts - b.ts) // chronological
  const pos: Record<string, { qty: number; avgEntry: number; openTs: number }> = {}
  const closed: ClosedTrade[] = []
  let buyCount = 0
  let sellCount = 0
  let totalFees = 0

  for (const t of trades) {
    totalFees += t.feeUsd
    const p = pos[t.tokenKey] ?? { qty: 0, avgEntry: 0, openTs: t.ts }
    if (t.side === 'buy') {
      buyCount++
      if (p.qty <= 1e-12) p.openTs = t.ts // opening a fresh position
      const newQty = p.qty + t.qtyToken
      const prevCost = p.qty * p.avgEntry
      p.avgEntry = newQty > 0 ? (prevCost + t.valueUsd) / newQty : t.priceUsd
      p.qty = newQty
      pos[t.tokenKey] = p
    } else {
      sellCount++
      const qty = Math.min(t.qtyToken, p.qty)
      const pnlUsd = (t.priceUsd - p.avgEntry) * qty - t.feeUsd
      const returnPct = p.avgEntry > 0 ? (t.priceUsd / p.avgEntry - 1) * 100 : 0
      closed.push({
        ts: t.ts,
        tokenKey: t.tokenKey,
        symbol: t.symbol,
        qty,
        avgEntry: p.avgEntry,
        exit: t.priceUsd,
        pnlUsd,
        returnPct,
        feeUsd: t.feeUsd,
        holdSec: Math.max(0, t.ts - p.openTs),
      })
      p.qty = Math.max(0, p.qty - qty)
      pos[t.tokenKey] = p
    }
  }

  if (!closed.length) {
    return { ...EMPTY(startingBalance), buyCount, sellCount, totalFees }
  }

  const wins = closed.filter((c) => c.pnlUsd > 0)
  const losses = closed.filter((c) => c.pnlUsd <= 0)
  const grossWin = wins.reduce((s, c) => s + c.pnlUsd, 0)
  const grossLoss = losses.reduce((s, c) => s + c.pnlUsd, 0) // <= 0
  const realizedPnl = grossWin + grossLoss

  // cumulative curve + max drawdown
  const curve: CurvePoint[] = [{ ts: closed[0].ts - 1, cum: 0 }]
  let cum = 0
  let peak = 0
  let maxDrawdown = 0
  for (const c of closed) {
    cum += c.pnlUsd
    curve.push({ ts: c.ts, cum })
    peak = Math.max(peak, cum)
    maxDrawdown = Math.min(maxDrawdown, cum - peak)
  }

  const byTokenMap: Record<string, { symbol: string; pnl: number }> = {}
  for (const c of closed) {
    const e = byTokenMap[c.tokenKey] ?? { symbol: c.symbol, pnl: 0 }
    e.pnl += c.pnlUsd
    byTokenMap[c.tokenKey] = e
  }

  return {
    hasData: true,
    closed: closed.slice().reverse(),
    realizedPnl,
    realizedPct: startingBalance ? (realizedPnl / startingBalance) * 100 : 0,
    totalFees,
    buyCount,
    sellCount,
    wins: wins.length,
    losses: losses.length,
    winRate: (wins.length / closed.length) * 100,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss < 0 ? grossWin / Math.abs(grossLoss) : grossWin > 0 ? Infinity : 0,
    largestWin: wins.length ? Math.max(...wins.map((c) => c.pnlUsd)) : 0,
    largestLoss: losses.length ? Math.min(...losses.map((c) => c.pnlUsd)) : 0,
    maxDrawdown,
    maxDrawdownPct: startingBalance ? (maxDrawdown / startingBalance) * 100 : 0,
    avgHoldSec: closed.reduce((s, c) => s + c.holdSec, 0) / closed.length,
    curve,
    byToken: Object.values(byTokenMap).sort((a, b) => b.pnl - a.pnl),
    startingBalance,
  }
}
