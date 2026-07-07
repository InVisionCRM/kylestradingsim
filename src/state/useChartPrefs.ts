import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ChartType = 'candles' | 'line'
export type ScaleMode = 'normal' | 'log' | 'percent'

interface ChartPrefsState {
  /** active indicators keyed by KLineChart indicator name (e.g. { VOL: true, MACD: true }) */
  indicators: Record<string, boolean>
  chartType: ChartType
  scaleMode: ScaleMode
  /** auto-scroll to follow new bars at the right edge; off = hold position for studying history */
  follow: boolean
  /** show the OHLCV legend at the top of the chart (off = only while the crosshair is active) */
  legend: boolean
  toggleIndicator: (name: string) => void
  setChartType: (t: ChartType) => void
  setScaleMode: (m: ScaleMode) => void
  setFollow: (v: boolean) => void
  setLegend: (v: boolean) => void
}

export const useChartPrefs = create<ChartPrefsState>()(
  persist(
    (set) => ({
      indicators: { VOL: true },
      chartType: 'candles',
      scaleMode: 'normal',
      follow: true,
      legend: true,
      toggleIndicator: (name) => set((s) => ({ indicators: { ...s.indicators, [name]: !s.indicators[name] } })),
      setChartType: (chartType) => set({ chartType }),
      setScaleMode: (m) => set((s) => ({ scaleMode: s.scaleMode === m ? 'normal' : m })),
      setFollow: (follow) => set({ follow }),
      setLegend: (legend) => set({ legend }),
    }),
    { name: 'paperdex.chartprefs.v4' },
  ),
)
