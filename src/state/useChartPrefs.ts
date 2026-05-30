import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type IndicatorKey = 'ema' | 'ma' | 'boll' | 'macd' | 'rsi' | 'kdj' | 'vol'
export type ChartType = 'candles' | 'line'
export type ScaleMode = 'normal' | 'log' | 'percent'

interface ChartPrefsState {
  ema: boolean
  ma: boolean
  boll: boolean
  macd: boolean
  rsi: boolean
  kdj: boolean
  vol: boolean
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
      ma: false,
      boll: false,
      macd: false,
      rsi: false,
      kdj: false,
      vol: true,
      chartType: 'candles',
      scaleMode: 'normal',
      toggle: (k) => set((s) => ({ [k]: !s[k] }) as Partial<ChartPrefsState>),
      setChartType: (chartType) => set({ chartType }),
      // Log and % are mutually exclusive; toggling the active one returns to normal.
      setScaleMode: (m) => set((s) => ({ scaleMode: s.scaleMode === m ? 'normal' : m })),
    }),
    { name: 'paperdex.chartprefs.v3' },
  ),
)
