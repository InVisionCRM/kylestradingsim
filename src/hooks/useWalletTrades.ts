import { useEffect } from 'react'
import { useWallet } from '../state/useWallet'
import { useMarket } from '../state/useMarket'
import { getTokenTransfers } from '../api/blockscout'
import { getTokenPoolAddresses } from '../api/dexscreener'
import { toWalletTrades } from '../lib/walletTrades'

/**
 * Overlays the imported wallet's trades for WHATEVER token is currently charted,
 * as long as that token is on the wallet's chain. Also pulls the token's liquidity
 * pools so each marker is classified as a real DEX buy/sell (counterparty is a pool)
 * vs a plain transfer. Clears when there's no match.
 */
export function useWalletTrades(): void {
  const wallet = useWallet((s) => s.address)
  const walletChain = useWallet((s) => s.chain)
  const pairChain = useMarket((s) => s.activePair?.chainId)
  const pairAddress = useMarket((s) => s.activePair?.pairAddress)
  const tokenAddress = useMarket((s) => s.activePair?.baseToken.address?.toLowerCase() ?? null)
  const onWalletChain = !!walletChain && pairChain === walletChain

  useEffect(() => {
    if (!wallet || !walletChain || !onWalletChain || !tokenAddress) {
      useWallet.getState().setTrades(null, [])
      return
    }
    let alive = true
    useWallet.getState().setTradesLoading(true)
    Promise.all([
      getTokenTransfers(walletChain, wallet, tokenAddress),
      getTokenPoolAddresses(walletChain, tokenAddress).catch(() => [] as string[]),
    ])
      .then(([raw, poolList]) => {
        if (!alive) return
        const pools = new Set(poolList)
        if (pairAddress) pools.add(pairAddress.toLowerCase()) // the charted pool always counts
        useWallet.getState().setTrades(tokenAddress, toWalletTrades(raw, wallet, pools))
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
  }, [wallet, walletChain, onWalletChain, tokenAddress, pairAddress])
}
