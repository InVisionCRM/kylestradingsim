import { useEffect, useRef } from 'react'
import { useMarket } from '../state/useMarket'
import { useWatchlist } from '../state/useWatchlist'
import { searchPairs, getPair } from '../api/dexscreener'
import { SEED_TOKENS, DEFAULT_TOKEN } from '../lib/seed'
import type { Pair } from '../types'

async function resolveSeed(symbol: string, chainId: string): Promise<Pair | null> {
  const pairs = await searchPairs(symbol)
  const exact = pairs.find(
    (p) => p.chainId === chainId && p.baseToken.symbol.toUpperCase() === symbol.toUpperCase(),
  )
  return exact ?? pairs.find((p) => p.chainId === chainId) ?? null
}

/** One-time startup: pick a default token (if none) and seed the watchlist. */
export function useBootstrap(): void {
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true

    void (async () => {
      const market = useMarket.getState()
      if (!market.activePair) {
        const p = await resolveSeed(DEFAULT_TOKEN.symbol, DEFAULT_TOKEN.chainId).catch(() => null)
        if (p) useMarket.getState().setActivePair(p)
      } else {
        const fresh = await getPair(market.activePair.chainId, market.activePair.pairAddress).catch(() => null)
        if (fresh) useMarket.getState().setActivePair(fresh)
      }

      const wl = useWatchlist.getState()
      if (!wl.seeded) {
        for (const s of SEED_TOKENS) {
          const p = await resolveSeed(s.symbol, s.chainId).catch(() => null)
          if (p)
            useWatchlist
              .getState()
              .add({ chainId: p.chainId, pairAddress: p.pairAddress, symbol: p.baseToken.symbol, imageUrl: p.imageUrl })
        }
        useWatchlist.getState().markSeeded()
      }
    })()
  }, [])
}
