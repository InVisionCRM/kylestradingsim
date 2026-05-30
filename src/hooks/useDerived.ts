import { useMemo } from 'react'
import { useMarketData } from '../state/useMarketData'
import { useReplay } from '../state/useReplay'
import { useSim } from '../state/useSim'
import { useMarket } from '../state/useMarket'
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

export function useEquity(): { equity: number; totalPnl: number; cash: number; startingBalance: number } {
  const acc = useSim((s) => s.accounts[s.mode])
  const price = useCurrentPrice()
  const activeKey = useActiveTokenKey()
  const equity = accountEquity(acc, (k) => (k === activeKey ? price : null))
  return { equity, totalPnl: equity - acc.startingBalanceUsd, cash: acc.cashUsd, startingBalance: acc.startingBalanceUsd }
}
