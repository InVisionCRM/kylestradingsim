import type { Pair } from '../types'
import { tokenKeyOf } from '../types'
import { toGeckoNetwork } from '../api/chains'
import { fetchTokenImage } from '../api/geckoterminal'
import { useLogos } from '../state/useLogos'

const inflight = new Set<string>()

/**
 * Resolve a token's logo once and cache it.
 * DexScreener `info.imageUrl` first; if missing (common for Solana tokens),
 * fall back to GeckoTerminal's token image. Deduped per token.
 */
export function ensureLogo(pair: Pair): void {
  const key = tokenKeyOf(pair.chainId, pair.pairAddress)
  if (useLogos.getState().map[key]) return
  if (pair.imageUrl) {
    useLogos.getState().set(key, pair.imageUrl)
    return
  }
  if (inflight.has(key)) return
  if (!toGeckoNetwork(pair.chainId) || !pair.baseToken.address) return
  inflight.add(key)
  fetchTokenImage(pair.chainId, pair.baseToken.address)
    .then((url) => {
      if (url) useLogos.getState().set(key, url)
    })
    .finally(() => inflight.delete(key))
}
