import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WatchItem } from '../types'

interface WatchState {
  items: WatchItem[]
  seeded: boolean
  add: (item: WatchItem) => void
  remove: (chainId: string, pairAddress: string) => void
  setItems: (items: WatchItem[]) => void
  markSeeded: () => void
}

const sameItem = (a: WatchItem, chainId: string, pairAddress: string) =>
  a.chainId === chainId && a.pairAddress === pairAddress

export const useWatchlist = create<WatchState>()(
  persist(
    (set, get) => ({
      items: [],
      seeded: false,
      add: (item) => {
        const { items } = get()
        if (items.some((i) => sameItem(i, item.chainId, item.pairAddress))) return
        set({ items: [...items, item] })
      },
      remove: (chainId, pairAddress) =>
        set({ items: get().items.filter((i) => !sameItem(i, chainId, pairAddress)) }),
      setItems: (items) => set({ items }),
      markSeeded: () => set({ seeded: true }),
    }),
    { name: 'paperdex.watchlist.v1' },
  ),
)
