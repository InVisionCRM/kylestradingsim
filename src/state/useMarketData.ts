import { create } from 'zustand'
import type { Candle } from '../types'

interface MarketDataState {
  candles: Candle[]
  /** `${chainId}:${pairAddress}` the loaded candles belong to — lets a timeframe
   *  switch keep showing the old series while the new one loads (stale-while-loading),
   *  while a token switch blanks immediately. */
  candlesFor: string | null
  loading: boolean
  error: string | null
  livePrice: number | null
  /** bump to re-run the candles loader (retry button) */
  reloadTick: number
  setCandles: (candles: Candle[], candlesFor: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setLivePrice: (livePrice: number | null) => void
  requestReload: () => void
}

/** Transient live data for the active pair (candles + polled price). Not persisted. */
export const useMarketData = create<MarketDataState>((set) => ({
  candles: [],
  candlesFor: null,
  loading: false,
  error: null,
  livePrice: null,
  reloadTick: 0,
  setCandles: (candles, candlesFor) => set({ candles, candlesFor }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setLivePrice: (livePrice) => set({ livePrice }),
  requestReload: () => set((s) => ({ reloadTick: s.reloadTick + 1 })),
}))
