import { create } from 'zustand'

interface UiState {
  analyticsOpen: boolean
  openAnalytics: () => void
  closeAnalytics: () => void
}

export const useUi = create<UiState>((set) => ({
  analyticsOpen: false,
  openAnalytics: () => set({ analyticsOpen: true }),
  closeAnalytics: () => set({ analyticsOpen: false }),
}))
