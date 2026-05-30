import { useEffect } from 'react'
import { useWallet } from '../state/useWallet'
import { useMarket } from '../state/useMarket'
import { getTokenTransfers } from '../api/blockscout'
import { toWalletTrades } from '../lib/walletTrades'

/**
 * Overlays the imported wallet's trades for WHATEVER token is currently charted,
 * as long as that token is on the wallet's chain. So once a wallet is imported you
 * can pick any token — the watchlist, the search box, or the wallet's own holdings —
 * and see that wallet's buys/sells on it. Clears when there's no match.
 */
export function useWalletTrades(): void {
  const wallet = useWallet((s) => s.address)
  const walletChain = useWallet((s) => s.chain)
  const pairChain = useMarket((s) => s.activePair?.chainId)
  const tokenAddress = useMarket((s) => s.activePair?.baseToken.address?.toLowerCase() ?? null)
  const onWalletChain = !!walletChain && pairChain === walletChain

  useEffect(() => {
    if (!wallet || !walletChain || !onWalletChain || !tokenAddress) {
      useWallet.getState().setTrades(null, [])
      return
    }
    let alive = true
    useWallet.getState().setTradesLoading(true)
    getTokenTransfers(walletChain, wallet, tokenAddress)
      .then((raw) => {
        if (alive) useWallet.getState().setTrades(tokenAddress, toWalletTrades(raw, wallet))
      })
      .catch(() => {
        if (alive) useWallet.getState().setTrades(tokenAddress, [])
      })
      .finally(() => {
        if (alive) useWallet.getState().setTradesLoading(false)
      })
    return () => {
      alive = false
    }
  }, [wallet, walletChain, onWalletChain, tokenAddress])
}
