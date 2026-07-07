import { create } from 'zustand'
import type { TapeTrade } from '../api/pulsex'

const CAP = 100

interface TapeState {
  /** `${chainId}:${pairAddress}` the tape currently belongs to */
  pairKey: string | null
  trades: TapeTrade[]
  loading: boolean
  error: boolean
  reset: (pairKey: string | null) => void
  merge: (incoming: TapeTrade[]) => void
  setLoading: (v: boolean) => void
  setError: (v: boolean) => void
}

/** Live PulseX trade-tape state for the active pair. */
export const useTape = create<TapeState>((set) => ({
  pairKey: null,
  trades: [],
  loading: false,
  error: false,
  reset: (pairKey) => set({ pairKey, trades: [], loading: pairKey != null, error: false }),
  merge: (incoming) =>
    set((s) => {
      const seen = new Set(s.trades.map((t) => t.id))
      const fresh: TapeTrade[] = []
      for (const t of incoming) {
        if (seen.has(t.id)) continue // dedupe against existing AND within the batch
        seen.add(t.id)
        fresh.push(t)
      }
      if (!fresh.length) return { loading: false, error: false }
      const trades = [...fresh, ...s.trades].sort((a, b) => b.ts - a.ts).slice(0, CAP)
      return { trades, loading: false, error: false }
    }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}))
