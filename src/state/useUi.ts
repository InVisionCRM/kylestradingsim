import { create } from 'zustand'

export type MobileTab = 'chart' | 'watch' | 'positions'

/** Everything the shareable P&L card needs to render. */
export interface FlexInfo {
  symbol: string
  roiPct: number
  pnlUsd: number
  entryUsd: number
  markUsd: number
  /** true = realized (closed round trip), false = open position */
  closed: boolean
}

interface UiState {
  analyticsOpen: boolean
  mobileTab: MobileTab
  searchOpen: boolean
  flex: FlexInfo | null
  openAnalytics: () => void
  closeAnalytics: () => void
  setMobileTab: (t: MobileTab) => void
  openSearch: () => void
  closeSearch: () => void
  openFlex: (f: FlexInfo) => void
  closeFlex: () => void
}

export const useUi = create<UiState>((set) => ({
  analyticsOpen: false,
  mobileTab: 'chart',
  searchOpen: false,
  flex: null,
  openAnalytics: () => set({ analyticsOpen: true }),
  closeAnalytics: () => set({ analyticsOpen: false }),
  setMobileTab: (mobileTab) => set({ mobileTab }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  openFlex: (flex) => set({ flex }),
  closeFlex: () => set({ flex: null }),
}))
