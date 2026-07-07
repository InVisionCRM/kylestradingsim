import { create } from 'zustand'

export type MobileTab = 'chart' | 'trade' | 'watch' | 'positions'

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
  orderSheetOpen: boolean
  searchOpen: boolean
  flex: FlexInfo | null
  openAnalytics: () => void
  closeAnalytics: () => void
  setMobileTab: (t: MobileTab) => void
  openOrderSheet: () => void
  closeOrderSheet: () => void
  openSearch: () => void
  closeSearch: () => void
  openFlex: (f: FlexInfo) => void
  closeFlex: () => void
}

export const useUi = create<UiState>((set) => ({
  analyticsOpen: false,
  mobileTab: 'chart',
  orderSheetOpen: false,
  searchOpen: false,
  flex: null,
  openAnalytics: () => set({ analyticsOpen: true }),
  closeAnalytics: () => set({ analyticsOpen: false }),
  setMobileTab: (mobileTab) => set({ mobileTab }),
  openOrderSheet: () => set({ orderSheetOpen: true }),
  closeOrderSheet: () => set({ orderSheetOpen: false }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  openFlex: (flex) => set({ flex }),
  closeFlex: () => set({ flex: null }),
}))
