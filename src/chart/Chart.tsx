import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  ColorType,
  CrosshairMode,
  LineStyle,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '../types'
import type { ChartType, ScaleMode } from '../state/useChartPrefs'
import { formatPrice, formatPct } from '../lib/format'
import { ema, sma, bollinger, vwap, rsi } from '../lib/indicators'

export interface ChartMarker {
  time: number
  side: 'buy' | 'sell'
  text: string
}
export interface Indicators {
  ema: boolean
  sma: boolean
  bb: boolean
  vwap: boolean
  rsi: boolean
  volMa: boolean
}
export interface ChartHandle {
  takeScreenshot: () => HTMLCanvasElement | null
}
interface Props {
  candles: Candle[]
  markers: ChartMarker[]
  avgEntry: number | null
  chartType: ChartType
  scaleMode: ScaleMode
  indicators: Indicators
}

type AnyMain = ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>
type LinePoint = { time: UTCTimestamp; value: number }

function minMoveFor(price: number): number {
  if (price >= 1) return 0.0001
  if (price >= 0.01) return 0.000001
  if (price >= 0.0001) return 1e-8
  return 1e-12
}
function zip(times: number[], vals: (number | null)[]): LinePoint[] {
  const out: LinePoint[] = []
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i]
    if (v != null && isFinite(v)) out.push({ time: times[i] as UTCTimestamp, value: v })
  }
  return out
}

export const Chart = forwardRef<ChartHandle, Props>(function Chart(
  { candles, markers, avgEntry, chartType, scaleMode, indicators },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainRef = useRef<AnyMain | null>(null)
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const avgLineRef = useRef<IPriceLine | null>(null)
  const candlesRef = useRef<Candle[]>([])
  const fittedRef = useRef(false)

  const ind = useRef<Record<string, ISeriesApi<'Line'> | null>>({
    ema1: null, ema2: null, sma: null, bbU: null, bbM: null, bbL: null, vwap: null, rsi: null, volMa: null,
  })

  useImperativeHandle(ref, () => ({
    takeScreenshot: () => chartRef.current?.takeScreenshot() ?? null,
  }))

  const renderLegend = (b: { open: number; high: number; low: number; close: number } | undefined) => {
    const el = legendRef.current
    if (!el) return
    if (!b) return void (el.innerHTML = '')
    const up = b.close >= b.open
    const pct = b.open ? (b.close / b.open - 1) * 100 : 0
    const cls = up ? 'up' : 'down'
    el.innerHTML =
      `<span>O <b>${formatPrice(b.open)}</b></span><span>H <b>${formatPrice(b.high)}</b></span>` +
      `<span>L <b>${formatPrice(b.low)}</b></span><span>C <b class="${cls}">${formatPrice(b.close)}</b></span>` +
      `<span class="${cls}">${formatPct(pct)}</span>`
  }

  const applyMainData = () => {
    const m = mainRef.current
    const cs = candlesRef.current
    if (!m || !cs.length) return
    m.applyOptions({
      priceFormat: { type: 'custom', formatter: (p: number) => formatPrice(p), minMove: minMoveFor(cs[cs.length - 1].close) },
    })
    if (chartType === 'line') {
      ;(m as ISeriesApi<'Line'>).setData(cs.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })))
    } else {
      ;(m as ISeriesApi<'Candlestick'>).setData(
        cs.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })),
      )
    }
  }

  const applyIndicators = () => {
    const cs = candlesRef.current
    const times = cs.map((c) => c.time)
    const closes = cs.map((c) => c.close)
    const vols = cs.map((c) => c.volume)
    const r = ind.current
    if (r.ema1) r.ema1.setData(zip(times, ema(closes, 9)))
    if (r.ema2) r.ema2.setData(zip(times, ema(closes, 21)))
    if (r.sma) r.sma.setData(zip(times, sma(closes, 50)))
    if (r.bbU || r.bbL || r.bbM) {
      const b = bollinger(closes, 20, 2)
      if (r.bbU) r.bbU.setData(zip(times, b.upper))
      if (r.bbM) r.bbM.setData(zip(times, b.middle))
      if (r.bbL) r.bbL.setData(zip(times, b.lower))
    }
    if (r.vwap) r.vwap.setData(zip(times, vwap(cs)))
    if (r.rsi) r.rsi.setData(zip(times, rsi(closes, 14)))
    if (r.volMa) r.volMa.setData(zip(times, sma(vols, 20)))
  }

  const applyMarkers = () => {
    const m = markersRef.current
    const cs = candlesRef.current
    if (!m) return
    if (!cs.length) return void m.setMarkers([])
    const times = cs.map((c) => c.time)
    const maxT = times[times.length - 1]
    const snapped: SeriesMarker<Time>[] = markers
      .filter((mk) => mk.time <= maxT + 1)
      .map((mk) => {
        let t = times[0]
        for (const ct of times) {
          if (ct <= mk.time) t = ct
          else break
        }
        return {
          time: t as UTCTimestamp,
          position: mk.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
          color: mk.side === 'buy' ? '#4ade80' : '#f87171',
          shape: mk.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
          text: mk.text,
        }
      })
      .sort((a, b) => (a.time as number) - (b.time as number))
    m.setMarkers(snapped)
  }

  const applyAvg = () => {
    const m = mainRef.current
    if (!m) return
    if (avgLineRef.current) {
      m.removePriceLine(avgLineRef.current)
      avgLineRef.current = null
    }
    if (avgEntry && avgEntry > 0) {
      avgLineRef.current = m.createPriceLine({
        price: avgEntry, color: '#9ca1a9', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'avg',
      })
    }
  }

  // create chart once
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca1a9',
        fontFamily: "'JetBrains Mono', monospace",
        attributionLogo: false,
      },
      grid: { vertLines: { color: '#1c1d21' }, horzLines: { color: '#1c1d21' } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3a3c40', labelBackgroundColor: '#2a2c30', style: LineStyle.Dotted },
        horzLine: { color: '#3a3c40', labelBackgroundColor: '#2a2c30' },
      },
      rightPriceScale: { borderColor: '#2a2c30', scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: '#2a2c30', timeVisible: true, secondsVisible: false, rightOffset: 4 },
    })
    const volSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    chartRef.current = chart
    volRef.current = volSeries

    chart.subscribeCrosshairMove((param) => {
      const cs = candlesRef.current
      if (param.time != null) {
        const tt = param.time as number
        const hovered = cs.find((x) => x.time === tt)
        if (hovered) return renderLegend(hovered)
      }
      renderLegend(cs[cs.length - 1])
    })

    return () => {
      chart.remove()
      chartRef.current = null
      mainRef.current = null
      volRef.current = null
      markersRef.current = null
      avgLineRef.current = null
      ind.current = { ema1: null, ema2: null, sma: null, bbU: null, bbM: null, bbL: null, vwap: null, rsi: null, volMa: null }
      fittedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // (re)build the main series when chart type changes
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (mainRef.current) {
      chart.removeSeries(mainRef.current)
      mainRef.current = null
      markersRef.current = null
      avgLineRef.current = null
    }
    mainRef.current =
      chartType === 'line'
        ? chart.addSeries(LineSeries, { color: '#e6e9ee', lineWidth: 2, priceLineVisible: false })
        : chart.addSeries(CandlestickSeries, {
            upColor: '#4ade80', downColor: '#f87171', wickUpColor: '#4ade80', wickDownColor: '#f87171', borderVisible: false,
          })
    markersRef.current = createSeriesMarkers(mainRef.current, [])
    applyMainData()
    applyMarkers()
    applyAvg()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType])

  // candle data
  useEffect(() => {
    candlesRef.current = candles
    applyMainData()
    const vs = volRef.current
    if (vs)
      vs.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(74,222,128,0.32)' : 'rgba(248,113,113,0.32)',
        })),
      )
    applyIndicators()
    renderLegend(candles[candles.length - 1])
    if (!fittedRef.current && candles.length) {
      chartRef.current?.timeScale().fitContent()
      fittedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, chartType])

  // price scale mode (normal / log / percent)
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const mode =
      scaleMode === 'log' ? PriceScaleMode.Logarithmic : scaleMode === 'percent' ? PriceScaleMode.Percentage : PriceScaleMode.Normal
    chart.priceScale('right').applyOptions({ mode })
  }, [scaleMode])

  // indicator existence toggles
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const r = ind.current
    if (indicators.ema && !r.ema1) {
      r.ema1 = chart.addSeries(LineSeries, { color: '#e6ff3a', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      r.ema2 = chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      applyIndicators()
    } else if (!indicators.ema && r.ema1) {
      chart.removeSeries(r.ema1); r.ema1 = null
      if (r.ema2) { chart.removeSeries(r.ema2); r.ema2 = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.ema])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const r = ind.current
    if (indicators.sma && !r.sma) {
      r.sma = chart.addSeries(LineSeries, { color: '#f0a35e', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      applyIndicators()
    } else if (!indicators.sma && r.sma) {
      chart.removeSeries(r.sma); r.sma = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.sma])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const r = ind.current
    if (indicators.bb && !r.bbU) {
      const o = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }
      r.bbU = chart.addSeries(LineSeries, { color: 'rgba(56,189,248,0.6)', ...o })
      r.bbM = chart.addSeries(LineSeries, { color: 'rgba(56,189,248,0.3)', ...o })
      r.bbL = chart.addSeries(LineSeries, { color: 'rgba(56,189,248,0.6)', ...o })
      applyIndicators()
    } else if (!indicators.bb && r.bbU) {
      ;[r.bbU, r.bbM, r.bbL].forEach((s) => s && chart.removeSeries(s))
      r.bbU = r.bbM = r.bbL = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.bb])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const r = ind.current
    if (indicators.vwap && !r.vwap) {
      r.vwap = chart.addSeries(LineSeries, { color: '#f472b6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      applyIndicators()
    } else if (!indicators.vwap && r.vwap) {
      chart.removeSeries(r.vwap); r.vwap = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.vwap])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const r = ind.current
    if (indicators.rsi && !r.rsi) {
      const s = chart.addSeries(LineSeries, { color: '#c084fc', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, 1)
      s.createPriceLine({ price: 70, color: '#2a2c30', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70' })
      s.createPriceLine({ price: 30, color: '#2a2c30', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '30' })
      r.rsi = s
      try { chart.panes()[1]?.setHeight(120) } catch { /* best-effort */ }
      applyIndicators()
    } else if (!indicators.rsi && r.rsi) {
      chart.removeSeries(r.rsi); r.rsi = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.rsi])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const r = ind.current
    if (indicators.volMa && !r.volMa) {
      r.volMa = chart.addSeries(LineSeries, { color: '#e6ff3a', lineWidth: 1, priceScaleId: 'vol', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      applyIndicators()
    } else if (!indicators.volMa && r.volMa) {
      chart.removeSeries(r.volMa); r.volMa = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.volMa])

  // markers + avg line
  useEffect(applyMarkers, [markers, candles])
  useEffect(applyAvg, [avgEntry])

  return (
    <div className="chart-host">
      <div ref={elRef} className="chart" />
      <div ref={legendRef} className="ohlc" />
    </div>
  )
})
