import { useMemo } from 'react'
import { useMarketData } from '../state/useMarketData'
import { useReplay } from '../state/useReplay'
import { useSim } from '../state/useSim'
import { useMarket } from '../state/useMarket'
import { usePrices } from '../state/usePrices'
import { accountEquity } from '../sim/engine'
import { tokenKeyOf, type Candle } from '../types'

export function useActiveTokenKey(): string | null {
  const pair = useMarket((s) => s.activePair)
  return pair ? tokenKeyOf(pair.chainId, pair.pairAddress) : null
}

/** Candles to render: in replay we reveal up to the cursor; live merges the polled price into the last bar. */
export function useVisibleCandles(): Candle[] {
  const candles = useMarketData((s) => s.candles)
  const livePrice = useMarketData((s) => s.livePrice)
  const mode = useSim((s) => s.mode)
  const cursor = useReplay((s) => s.cursor)

  return useMemo(() => {
    if (mode === 'replay') return candles.slice(0, cursor + 1)
    if (livePrice && livePrice > 0 && candles.length) {
      const last = { ...candles[candles.length - 1] }
      last.close = livePrice
      last.high = Math.max(last.high, livePrice)
      last.low = Math.min(last.low, livePrice)
      return [...candles.slice(0, -1), last]
    }
    return candles
  }, [candles, livePrice, mode, cursor])
}

/** The price an order fills at right now. */
export function useCurrentPrice(): number | null {
  const candles = useMarketData((s) => s.candles)
  const livePrice = useMarketData((s) => s.livePrice)
  const mode = useSim((s) => s.mode)
  const cursor = useReplay((s) => s.cursor)

  if (mode === 'replay') return candles[cursor]?.close ?? null
  return livePrice ?? candles[candles.length - 1]?.close ?? null
}

/**
 * Returns a pricing function valid for ANY held token. In live mode it reads the
 * shared price map (fed by the positions loader); in replay only the active token
 * has a meaningful price, others fall back to cost basis.
 */
export function usePriceFor(): (tokenKey: string) => number | null {
  const mode = useSim((s) => s.mode)
  const activeKey = useActiveTokenKey()
  const activePrice = useCurrentPrice()
  const map = usePrices((s) => s.map)
  return (k) => (mode === 'replay' ? (k === activeKey ? activePrice : null) : map[k] ?? (k === activeKey ? activePrice : null))
}

export function useEquity(): { equity: number; totalPnl: number; cash: number; startingBalance: number } {
  const acc = useSim((s) => s.accounts[s.mode])
  const priceFor = usePriceFor()
  const equity = accountEquity(acc, priceFor)
  return { equity, totalPnl: equity - acc.startingBalanceUsd, cash: acc.cashUsd, startingBalance: acc.startingBalanceUsd }
}
