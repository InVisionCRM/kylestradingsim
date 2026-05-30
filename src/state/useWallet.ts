import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ADDRESS_RX, EVM_CHAINS, getTokenHoldings, type EvmChain, type TokenHolding } from '../api/blockscout'
import type { WalletTrade } from '../lib/walletTrades'

export type WalletStatus = 'idle' | 'loading' | 'ready' | 'error'

/** The wallet token currently charted (drives the on-chain trade overlay). */
export interface ActiveWalletToken {
  address: string
  chain: EvmChain
  symbol: string
}

interface WalletState {
  // imported wallet (persisted)
  address: string | null
  chain: EvmChain | null
  holdings: TokenHolding[]
  showOverlay: boolean
  // transient
  status: WalletStatus
  error: string | null
  activeToken: ActiveWalletToken | null
  trades: WalletTrade[]
  tradesFor: string | null // token address the trades belong to
  tradesLoading: boolean

  importWallet: (address: string) => Promise<void>
  clear: () => void
  toggleOverlay: () => void
  setActiveToken: (t: ActiveWalletToken | null) => void
  setTrades: (tokenAddress: string | null, trades: WalletTrade[]) => void
  setTradesLoading: (loading: boolean) => void
}

export const useWallet = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      chain: null,
      holdings: [],
      showOverlay: true,
      status: 'idle',
      error: null,
      activeToken: null,
      trades: [],
      tradesFor: null,
      tradesLoading: false,

      importWallet: async (input) => {
        const address = input.trim().toLowerCase()
        if (!ADDRESS_RX.test(address)) {
          set({ status: 'error', error: 'Enter a valid 0x… wallet address' })
          return
        }
        set({ status: 'loading', error: null, address, holdings: [], activeToken: null, trades: [], tradesFor: null })

        // Auto-detect: pull holdings on both chains. Track reachability separately so a
        // down explorer reads as "unreachable" — never as "this wallet has no tokens".
        const results = await Promise.all(
          EVM_CHAINS.map(async (chain) => {
            try {
              return { chain, holdings: await getTokenHoldings(chain, address), reachable: true }
            } catch {
              return { chain, holdings: [] as TokenHolding[], reachable: false }
            }
          }),
        )

        const withTokens = results.filter((r) => r.holdings.length > 0)
        if (withTokens.length > 0) {
          const best = withTokens.reduce((a, b) => (b.holdings.length > a.holdings.length ? b : a))
          set({ status: 'ready', chain: best.chain, holdings: best.holdings, error: null })
          return
        }

        // Nothing came back — be honest about why.
        const down = results.filter((r) => !r.reachable).map((r) => (r.chain === 'pulsechain' ? 'PulseChain' : 'Ethereum'))
        if (down.length === EVM_CHAINS.length) {
          set({ status: 'error', error: "Couldn't reach either block explorer — they may be down. Try again shortly." })
        } else if (down.length > 0) {
          set({ status: 'error', error: `The ${down.join(' & ')} explorer is down right now, so its tokens can't be loaded. Try again shortly.` })
        } else {
          set({ status: 'error', error: 'No ERC-20 tokens found on PulseChain or Ethereum for that wallet' })
        }
      },

      clear: () =>
        set({
          address: null,
          chain: null,
          holdings: [],
          status: 'idle',
          error: null,
          activeToken: null,
          trades: [],
          tradesFor: null,
        }),

      toggleOverlay: () => set((s) => ({ showOverlay: !s.showOverlay })),
      setActiveToken: (activeToken) => set({ activeToken }),
      setTrades: (tradesFor, trades) => set({ trades, tradesFor }),
      setTradesLoading: (tradesLoading) => set({ tradesLoading }),
    }),
    {
      name: 'paperdex.wallet.v1',
      // persist only the imported wallet + overlay preference; trades/status refetch live
      partialize: (s) => ({ address: s.address, chain: s.chain, holdings: s.holdings, showOverlay: s.showOverlay }),
    },
  ),
)
