import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { init, dispose, CandleType, YAxisType } from 'klinecharts'
import type { Chart as KLineChartApi, KLineData, DeepPartial, Styles } from 'klinecharts'
import type { Candle } from '../types'
import type { ChartType, ScaleMode } from '../state/useChartPrefs'
import { registerCustomIndicators } from './registerIndicators'
import { isOverlayIndicator } from './indicatorCatalog'

registerCustomIndicators()

export interface ChartHandle {
  startDrawing: (overlayName: string) => void
  clearDrawings: () => void
  screenshot: () => string | null
}
export interface ChartMarker {
  time: number
  price: number
  side: 'buy' | 'sell'
  text: string
}
interface Props {
  candles: Candle[]
  chartType: ChartType
  scaleMode: ScaleMode
  indicators: Record<string, boolean>
  avgEntry: number | null
  markers: ChartMarker[]
  tokenKey: string
}

// overlay groups so "Clear" only removes user drawings, never markers / avg line
const G_USER = 'pdx-user'
const G_POS = 'pdx-pos'
const G_TRADES = 'pdx-trades'

const CANDLE_PANE = 'candle_pane'

function toKLine(cs: Candle[]): KLineData[] {
  return cs.map((c) => ({ timestamp: c.time * 1000, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }))
}

function themeStyles(chartType: ChartType, scaleMode: ScaleMode): DeepPartial<Styles> {
  const up = '#2ee6a6', down = '#f87171', nochg = '#8fa3be'
  const grid = '#13233c', axis = '#21385a', tick = '#7e90a8', text = '#eef3fa', cross = '#4a5f82'
  return {
    grid: { horizontal: { color: grid }, vertical: { color: grid } },
    candle: {
      type: chartType === 'line' ? CandleType.Area : CandleType.CandleSolid,
      bar: {
        upColor: up, downColor: down, noChangeColor: nochg,
        upBorderColor: up, downBorderColor: down, noChangeBorderColor: nochg,
        upWickColor: up, downWickColor: down, noChangeWickColor: nochg,
      },
      area: {
        lineColor: '#9fb2ff',
        lineSize: 2,
        backgroundColor: [
          { offset: 0, color: 'rgba(99,102,241,0.18)' },
          { offset: 1, color: 'rgba(99,102,241,0)' },
        ],
      },
      priceMark: { high: { color: tick }, low: { color: tick } },
      tooltip: { text: { color: text } },
    },
    xAxis: { axisLine: { color: axis }, tickLine: { color: axis }, tickText: { color: tick } },
    yAxis: {
      type: scaleMode === 'log' ? YAxisType.Log : scaleMode === 'percent' ? YAxisType.Percentage : YAxisType.Normal,
      axisLine: { color: axis },
      tickLine: { color: axis },
      tickText: { color: tick },
    },
    crosshair: {
      horizontal: { line: { color: cross }, text: { color: text } },
      vertical: { line: { color: cross }, text: { color: text } },
    },
    separator: { color: axis },
    indicator: { tooltip: { text: { color: text } } },
    overlay: {
      // accent handles normally, subtle white highlight when hovered / selected
      point: {
        color: '#6366f1',
        borderColor: '#0a1020',
        borderSize: 1,
        radius: 4,
        activeColor: '#ffffff',
        activeBorderColor: '#ffffff',
        activeBorderSize: 2,
        activeRadius: 5,
      },
      line: { color: '#6366f1', size: 1 },
    },
  }
}

export const Chart = forwardRef<ChartHandle, Props>(function Chart(
  { candles, chartType, scaleMode, indicators, avgEntry, markers, tokenKey },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<KLineChartApi | null>(null)
  const candlesRef = useRef<Candle[]>([])
  const paneIds = useRef<Record<string, string>>({})
  const selectedRef = useRef<string | null>(null)

  useImperativeHandle(ref, () => ({
    startDrawing: (name) => {
      chartRef.current?.createOverlay({
        name,
        groupId: G_USER,
        onSelected: (e) => {
          selectedRef.current = e.overlay.id
          return false
        },
        onDeselected: () => {
          selectedRef.current = null
          return false
        },
      })
    },
    clearDrawings: () => {
      chartRef.current?.removeOverlay({ groupId: G_USER })
    },
    screenshot: () => chartRef.current?.getConvertPictureUrl(true, 'png', '#0a1020') ?? null,
  }))

  // init once
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    // decimalFoldThreshold folds long zero-runs into compact 0.0ₙ123 form for memecoin prices.
    const chart = init(el, { styles: themeStyles(chartType, scaleMode), decimalFoldThreshold: 3 })
    chartRef.current = chart
    const onResize = () => chartRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      dispose(el)
      chartRef.current = null
      paneIds.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // data + price precision (so sub-penny memecoin prices aren't rounded to 0.00)
  useEffect(() => {
    candlesRef.current = candles
    const chart = chartRef.current
    if (!chart) return
    const last = candles.length ? candles[candles.length - 1].close : 1
    const precision = last >= 1 ? 4 : last >= 0.01 ? 6 : last >= 0.0001 ? 8 : 10
    chart.setPriceVolumePrecision(precision, 2)
    chart.applyNewData(toKLine(candles))
  }, [candles])

  // theme: candle type + scale mode
  useEffect(() => {
    chartRef.current?.setStyles(themeStyles(chartType, scaleMode))
  }, [chartType, scaleMode])

  // indicators: create / remove to match the active set (any KLineChart built-in + custom VWAP)
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    // remove ones turned off
    Object.keys(paneIds.current).forEach((name) => {
      if (!indicators[name]) {
        chart.removeIndicator(paneIds.current[name], name)
        delete paneIds.current[name]
      }
    })
    // add ones turned on
    Object.keys(indicators).forEach((name) => {
      if (indicators[name] && !paneIds.current[name]) {
        const overlay = isOverlayIndicator(name)
        const id = chart.createIndicator(name, overlay, overlay ? { id: CANDLE_PANE } : undefined)
        paneIds.current[name] = typeof id === 'string' ? id : overlay ? CANDLE_PANE : ''
      }
    })
  }, [indicators])

  const hasData = candles.length > 0

  // average-entry line (own group → not removed by "Clear")
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.removeOverlay({ groupId: G_POS })
    if (avgEntry && avgEntry > 0 && hasData) {
      chart.createOverlay({
        name: 'priceLine',
        groupId: G_POS,
        lock: true,
        points: [{ value: avgEntry }],
        styles: { line: { color: '#6366f1' } },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avgEntry, hasData])

  // trade markers (own group → not removed by "Clear")
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !hasData) return
    chart.removeOverlay({ groupId: G_TRADES })
    markers.forEach((m) => {
      chart.createOverlay({
        name: 'simpleAnnotation',
        groupId: G_TRADES,
        lock: true,
        points: [{ timestamp: m.time * 1000, value: m.price }],
        extendData: m.text,
        styles: { text: { color: m.side === 'buy' ? '#2ee6a6' : '#f87171', size: 12, weight: 'bold' } },
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, hasData])

  // delete the selected drawing with Delete / Backspace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current) {
        chartRef.current?.removeOverlay({ id: selectedRef.current })
        selectedRef.current = null
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // drawings persist across timeframe changes; clear them only when the token changes
  useEffect(() => {
    chartRef.current?.removeOverlay({ groupId: G_USER })
    selectedRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenKey])

  return (
    <div className="chart-host">
      <div ref={elRef} className="chart" />
    </div>
  )
})
