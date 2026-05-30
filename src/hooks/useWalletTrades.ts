import { useEffect } from 'react'
import { useWallet } from '../state/useWallet'
import { getTokenTransfers } from '../api/blockscout'
import { toWalletTrades } from '../lib/walletTrades'

/**
 * When a wallet token is selected for charting, fetch that wallet's full on-chain
 * transfer history for the token and map it to plottable buy/sell trades.
 * Clears when nothing is selected.
 */
export function useWalletTrades(): void {
  const wallet = useWallet((s) => s.address)
  const tokenAddress = useWallet((s) => s.activeToken?.address)
  const chain = useWallet((s) => s.activeToken?.chain)

  useEffect(() => {
    if (!wallet || !tokenAddress || !chain) {
      useWallet.getState().setTrades(null, [])
      return
    }
    let alive = true
    useWallet.getState().setTradesLoading(true)
    getTokenTransfers(chain, wallet, tokenAddress)
      .then((raw) => {
        if (!alive) return
        useWallet.getState().setTrades(tokenAddress, toWalletTrades(raw, wallet))
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
  }, [wallet, tokenAddress, chain])
}
