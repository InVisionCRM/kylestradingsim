import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type IndicatorKey = 'ema' | 'volMa' | 'rsi'

interface ChartPrefsState {
  ema: boolean
  volMa: boolean
  rsi: boolean
  toggle: (k: IndicatorKey) => void
}

export const useChartPrefs = create<ChartPrefsState>()(
  persist(
    (set) => ({
      ema: false,
      volMa: false,
      rsi: false,
      toggle: (k) => set((s) => ({ [k]: !s[k] }) as Partial<ChartPrefsState>),
    }),
    { name: 'paperdex.chartprefs.v1' },
  ),
)
