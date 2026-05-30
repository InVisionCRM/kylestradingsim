import { create } from 'zustand'

interface PricesState {
  /** last-known USD price per tokenKey (`chainId:pairAddress`) */
  map: Record<string, number>
  /** last-known pool liquidity (USD) per tokenKey, for slippage */
  liq: Record<string, number>
  setPrice: (tokenKey: string, price: number, liquidity?: number | null) => void
}

/**
 * Shared last-known prices + liquidity for every token we've seen (active,
 * watchlist, positions). Powers equity/P&L valuation and slippage on resting orders.
 */
export const usePrices = create<PricesState>((set) => ({
  map: {},
  liq: {},
  setPrice: (tokenKey, price, liquidity) =>
    set((s) => {
      const map = price > 0 && s.map[tokenKey] !== price ? { ...s.map, [tokenKey]: price } : s.map
      const liq =
        liquidity != null && liquidity > 0 && s.liq[tokenKey] !== liquidity ? { ...s.liq, [tokenKey]: liquidity } : s.liq
      return map === s.map && liq === s.liq ? s : { map, liq }
    }),
}))
