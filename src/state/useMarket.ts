import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Pair, Timeframe } from '../types'

interface MarketState {
  activePair: Pair | null
  timeframe: Timeframe
  setActivePair: (p: Pair) => void
  setTimeframe: (tf: Timeframe) => void
}

export const useMarket = create<MarketState>()(
  persist(
    (set) => ({
      activePair: null,
      timeframe: '15m',
      setActivePair: (activePair) => set({ activePair }),
      setTimeframe: (timeframe) => set({ timeframe }),
    }),
    { name: 'paperdex.market.v1' },
  ),
)
