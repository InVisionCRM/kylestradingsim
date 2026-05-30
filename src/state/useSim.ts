import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Account, Mode, TokenRef } from '../types'
import { tokenKeyOf } from '../types'
import { applyBuy, applySell, newAccount } from '../sim/engine'

export const STARTING_BALANCE = 10000

interface Settings {
  feeBps: number
  slippageOn: boolean
}

interface SimState {
  mode: Mode
  settings: Settings
  accounts: Record<Mode, Account>
  setMode: (m: Mode) => void
  /** Throws SimError on failure — callers catch to show a message. */
  buy: (ref: TokenRef, priceUsd: number, usdAmount: number, ts: number) => void
  sell: (ref: TokenRef, priceUsd: number, qtyToken: number, ts: number) => void
  reset: (mode: Mode) => void
}

export const useSim = create<SimState>()(
  persist(
    (set, get) => ({
      mode: 'live',
      settings: { feeBps: 30, slippageOn: false },
      accounts: { live: newAccount(STARTING_BALANCE), replay: newAccount(STARTING_BALANCE) },

      setMode: (mode) => set({ mode }),

      buy: (ref, priceUsd, usdAmount, ts) => {
        const { mode, accounts, settings } = get()
        const next = applyBuy(accounts[mode], {
          tokenKey: tokenKeyOf(ref.chainId, ref.pairAddress),
          chainId: ref.chainId,
          pairAddress: ref.pairAddress,
          symbol: ref.symbol,
          imageUrl: ref.imageUrl,
          priceUsd,
          usdAmount,
          feeBps: settings.feeBps,
          mode,
          ts,
        })
        set({ accounts: { ...accounts, [mode]: next } })
      },

      sell: (ref, priceUsd, qtyToken, ts) => {
        const { mode, accounts, settings } = get()
        const next = applySell(accounts[mode], {
          tokenKey: tokenKeyOf(ref.chainId, ref.pairAddress),
          priceUsd,
          qtyToken,
          feeBps: settings.feeBps,
          mode,
          ts,
        })
        set({ accounts: { ...accounts, [mode]: next } })
      },

      reset: (mode) => {
        const { accounts } = get()
        set({ accounts: { ...accounts, [mode]: newAccount(STARTING_BALANCE) } })
      },
    }),
    { name: 'paperdex.sim.v1', version: 1 },
  ),
)
