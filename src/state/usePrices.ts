import { create } from 'zustand'

interface PricesState {
  /** last-known USD price per tokenKey (`chainId:pairAddress`) */
  map: Record<string, number>
  setPrice: (tokenKey: string, price: number) => void
}

/**
 * Shared last-known prices for every token we've seen (active, watchlist, positions).
 * Lets equity / P&L be valued across ALL positions, not just the selected one.
 */
export const usePrices = create<PricesState>((set) => ({
  map: {},
  setPrice: (tokenKey, price) =>
    set((s) => (price > 0 && s.map[tokenKey] !== price ? { map: { ...s.map, [tokenKey]: price } } : s)),
}))
