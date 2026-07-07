import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface RecentSearch {
  chainId: string
  pairAddress: string
  symbol: string
  imageUrl: string | null
}

interface RecentsState {
  items: RecentSearch[]
  add: (r: RecentSearch) => void
  clear: () => void
}

const MAX = 8

/** Recently picked search results, newest first (persisted). */
export const useRecents = create<RecentsState>()(
  persist(
    (set) => ({
      items: [],
      add: (r) =>
        set((s) => ({
          items: [r, ...s.items.filter((i) => !(i.chainId === r.chainId && i.pairAddress === r.pairAddress))].slice(0, MAX),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: 'paperdex.recents.v1' },
  ),
)