import type { Candle } from '../types'
import type { RawTransfer } from '../api/blockscout'

export type TradeSide = 'buy' | 'sell'

/** A wallet's on-chain acquisition/disposal of a token, ready to plot. */
export interface WalletTrade {
  ts: number // unix seconds
  side: TradeSide // buy = received into wallet, sell = sent out
  amount: number // token units
  txHash: string
}

/**
 * Direction relative to the wallet: token IN (to == wallet) is a buy/acquire,
 * token OUT (from == wallet) is a sell/dispose. Self-transfers and unrelated
 * rows (neither side is the wallet) are skipped.
 */
export function classifyTransfer(t: RawTransfer, wallet: string): TradeSide | null {
  const w = wallet.toLowerCase()
  const from = (t.from?.hash ?? '').toLowerCase()
  const to = (t.to?.hash ?? '').toLowerCase()
  const isIn = to === w
  const isOut = from === w
  if (isIn === isOut) return null // both or neither → not a directional trade
  return isIn ? 'buy' : 'sell'
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

/** Map raw transfers → plottable trades (directional, non-zero), oldest first. */
export function toWalletTrades(transfers: RawTransfer[], wallet: string): WalletTrade[] {
  const out: WalletTrade[] = []
  for (const t of transfers) {
    const side = classifyTransfer(t, wallet)
    if (!side) continue
    const amount = transferAmount(t)
    if (!(amount > 0)) continue
    const ts = tsSeconds(t.timestamp)
    if (!ts) continue
    out.push({ ts, side, amount, txHash: t.transaction_hash })
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
