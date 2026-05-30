import { create } from 'zustand'
import type { Candle } from '../types'

interface MarketDataState {
  candles: Candle[]
  loading: boolean
  error: string | null
  livePrice: number | null
  setCandles: (candles: Candle[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setLivePrice: (livePrice: number | null) => void
}

/** Transient live data for the active pair (candles + polled price). Not persisted. */
export const useMarketData = create<MarketDataState>((set) => ({
  candles: [],
  loading: false,
  error: null,
  livePrice: null,
  setCandles: (candles) => set({ candles }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setLivePrice: (livePrice) => set({ livePrice }),
}))
