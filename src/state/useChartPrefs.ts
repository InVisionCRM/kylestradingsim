import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ChartType = 'candles' | 'line'
export type ScaleMode = 'normal' | 'log' | 'percent'

interface ChartPrefsState {
  /** active indicators keyed by KLineChart indicator name (e.g. { VOL: true, MACD: true }) */
  indicators: Record<string, boolean>
  chartType: ChartType
  scaleMode: ScaleMode
  toggleIndicator: (name: string) => void
  setChartType: (t: ChartType) => void
  setScaleMode: (m: ScaleMode) => void
}

export const useChartPrefs = create<ChartPrefsState>()(
  persist(
    (set) => ({
      indicators: { VOL: true },
      chartType: 'candles',
      scaleMode: 'normal',
      toggleIndicator: (name) => set((s) => ({ indicators: { ...s.indicators, [name]: !s.indicators[name] } })),
      setChartType: (chartType) => set({ chartType }),
      setScaleMode: (m) => set((s) => ({ scaleMode: s.scaleMode === m ? 'normal' : m })),
    }),
    { name: 'paperdex.chartprefs.v4' },
  ),
)
