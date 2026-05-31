import type { Candle } from '../types'
import type { RawTransfer } from '../api/blockscout'

export type TradeKind = 'buy' | 'sell' | 'transfer'

/** A wallet's on-chain token movement, ready to plot. */
export interface WalletTrade {
  ts: number // unix seconds
  kind: TradeKind // buy = bought from a pool, sell = sold to a pool, transfer = plain move
  dir: 'in' | 'out' // direction relative to the wallet (kept so transfers can show in/out)
  amount: number // token units
  txHash: string
}

/** Direction relative to the wallet: 'in' (to == wallet), 'out' (from == wallet), else null. */
export function classifyDir(t: RawTransfer, wallet: string): 'in' | 'out' | null {
  const w = wallet.toLowerCase()
  const from = (t.from?.hash ?? '').toLowerCase()
  const to = (t.to?.hash ?? '').toLowerCase()
  const isIn = to === w
  const isOut = from === w
  if (isIn === isOut) return null // both or neither → not a directional move
  return isIn ? 'in' : 'out'
}

/** The address on the other side of the transfer from the wallet. */
export function counterparty(t: RawTransfer, dir: 'in' | 'out'): string {
  return ((dir === 'in' ? t.from?.hash : t.to?.hash) ?? '').toLowerCase()
}

/** Raw transfer amount → human token units (total.value ÷ 10^total.decimals). */
export function transferAmount(t: RawTransfer): number {
  const raw = t.total?.value
  if (!raw) return 0
  const decimals = Number(t.total?.decimals ?? '0') || 0
  const n = Number(raw)
  return isFinite(n) ? n / 10 ** decimals : 0
}

/** ISO-8601 (e.g. "2026-05-30T16:20:11.000000Z") → unix seconds; 0 if unparseable. */
export function tsSeconds(iso: string): number {
  const ms = Date.parse(iso)
  return isFinite(ms) ? Math.floor(ms / 1000) : 0
}

/**
 * Map raw transfers → plottable trades. A transfer whose counterparty is one of the
 * token's liquidity `pools` is a real DEX swap: IN from a pool = buy, OUT to a pool =
 * sell. Everything else (wallet-to-wallet, airdrop, CEX) is a plain 'transfer'.
 * `pools` must be lowercased addresses. Oldest first.
 */
export function toWalletTrades(transfers: RawTransfer[], wallet: string, pools: Set<string>): WalletTrade[] {
  const out: WalletTrade[] = []
  for (const t of transfers) {
    const dir = classifyDir(t, wallet)
    if (!dir) continue
    const amount = transferAmount(t)
    if (!(amount > 0)) continue
    const ts = tsSeconds(t.timestamp)
    if (!ts) continue
    const isSwap = pools.has(counterparty(t, dir))
    const kind: TradeKind = isSwap ? (dir === 'in' ? 'buy' : 'sell') : 'transfer'
    out.push({ ts, kind, dir, amount, txHash: t.transaction_hash })
  }
  return out.sort((a, b) => a.ts - b.ts)
}

/**
 * Approximate price at a timestamp = close of the last candle at/before it.
 * Clamps to the first/last candle when ts falls outside the loaded window.
 * Returns null only when there are no candles at all.
 */
export function priceAtTime(candles: Candle[], ts: number): number | null {
  if (!candles.length) return null
  if (ts <= candles[0].time) return candles[0].close
  if (ts >= candles[candles.length - 1].time) return candles[candles.length - 1].close
  let lo = 0
  let hi = candles.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (candles[mid].time <= ts) lo = mid
    else hi = mid - 1
  }
  return candles[lo].close
}
