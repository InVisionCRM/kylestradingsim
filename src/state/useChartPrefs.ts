import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type IndicatorKey = 'ema' | 'sma' | 'bb' | 'vwap' | 'rsi' | 'volMa'
export type ChartType = 'candles' | 'line'
export type ScaleMode = 'normal' | 'log' | 'percent'

interface ChartPrefsState {
  ema: boolean
  sma: boolean
  bb: boolean
  vwap: boolean
  rsi: boolean
  volMa: boolean
  chartType: ChartType
  scaleMode: ScaleMode
  toggle: (k: IndicatorKey) => void
  setChartType: (t: ChartType) => void
  setScaleMode: (m: ScaleMode) => void
}

export const useChartPrefs = create<ChartPrefsState>()(
  persist(
    (set) => ({
      ema: false,
      sma: false,
      bb: false,
      vwap: false,
      rsi: false,
      volMa: false,
      chartType: 'candles',
      scaleMode: 'normal',
      toggle: (k) => set((s) => ({ [k]: !s[k] }) as Partial<ChartPrefsState>),
      setChartType: (chartType) => set({ chartType }),
      // Log and % are mutually exclusive scale modes; toggling one off returns to normal.
      setScaleMode: (m) => set((s) => ({ scaleMode: s.scaleMode === m ? 'normal' : m })),
    }),
    { name: 'paperdex.chartprefs.v2' },
  ),
)
