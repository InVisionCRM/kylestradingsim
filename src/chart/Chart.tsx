import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '../types'
import { formatPrice, formatPct } from '../lib/format'
import { ema, sma, rsi } from '../lib/indicators'

export interface ChartMarker {
  time: number
  side: 'buy' | 'sell'
  text: string
}

interface Props {
  candles: Candle[]
  markers: ChartMarker[]
  avgEntry: number | null
  showEma: boolean
  showVolMa: boolean
  showRsi: boolean
  drawMode: boolean
  clearSignal: number
}

function minMoveFor(price: number): number {
  if (price >= 1) return 0.0001
  if (price >= 0.01) return 0.000001
  if (price >= 0.0001) return 1e-8
  return 1e-12
}

type LinePoint = { time: UTCTimestamp; value: number }
function zip(times: number[], vals: (number | null)[]): LinePoint[] {
  const out: LinePoint[] = []
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i]
    if (v != null && isFinite(v)) out.push({ time: times[i] as UTCTimestamp, value: v })
  }
  return out
}

export function Chart({ candles, markers, avgEntry, showEma, showVolMa, showRsi, drawMode, clearSignal }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const ema1Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ema2Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const volMaRef = useRef<ISeriesApi<'Line'> | null>(null)
  const rsiRef = useRef<ISeriesApi<'Line'> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const priceLineRef = useRef<IPriceLine | null>(null)
  const fittedRef = useRef(false)
  const candlesRef = useRef<Candle[]>([])
  const drawModeRef = useRef(false)
  const drawingsRef = useRef<ISeriesApi<'Line'>[]>([])
  const pendingRef = useRef<{ time: Time; price: number } | null>(null)

  const renderLegend = (b: { open: number; high: number; low: number; close: number } | undefined) => {
    const el = legendRef.current
    if (!el) return
    if (!b) {
      el.innerHTML = ''
      return
    }
    const up = b.close >= b.open
    const pct = b.open ? (b.close / b.open - 1) * 100 : 0
    const cls = up ? 'up' : 'down'
    el.innerHTML =
      `<span>O <b>${formatPrice(b.open)}</b></span>` +
      `<span>H <b>${formatPrice(b.high)}</b></span>` +
      `<span>L <b>${formatPrice(b.low)}</b></span>` +
      `<span>C <b class="${cls}">${formatPrice(b.close)}</b></span>` +
      `<span class="${cls}">${formatPct(pct)}</span>`
  }

  const applyIndicators = () => {
    const cs = candlesRef.current
    const times = cs.map((c) => c.time)
    const closes = cs.map((c) => c.close)
    const vols = cs.map((c) => c.volume)
    if (ema1Ref.current) ema1Ref.current.setData(zip(times, ema(closes, 9)))
    if (ema2Ref.current) ema2Ref.current.setData(zip(times, ema(closes, 21)))
    if (volMaRef.current) volMaRef.current.setData(zip(times, sma(vols, 20)))
    if (rsiRef.current) rsiRef.current.setData(zip(times, rsi(closes, 14)))
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
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#4ade80',
      downColor: '#f87171',
      wickUpColor: '#4ade80',
      wickDownColor: '#f87171',
      borderVisible: false,
    })
    const volSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })

    chartRef.current = chart
    candleRef.current = candleSeries
    volRef.current = volSeries
    markersRef.current = createSeriesMarkers(candleSeries, [])

    chart.subscribeCrosshairMove((param) => {
      const cs = candlesRef.current
      if (param.time != null) {
        const d = param.seriesData.get(candleSeries) as
          | { open: number; high: number; low: number; close: number }
          | undefined
        if (d && d.open != null) {
          renderLegend(d)
          return
        }
      }
      renderLegend(cs[cs.length - 1])
    })

    chart.subscribeClick((param) => {
      if (!drawModeRef.current || !param.point) return
      const series = candleRef.current
      if (!series) return
      const price = series.coordinateToPrice(param.point.y)
      const time = param.time ?? chart.timeScale().coordinateToTime(param.point.x)
      if (price == null || time == null) return
      if (!pendingRef.current) {
        pendingRef.current = { time, price }
      } else {
        const a = pendingRef.current
        const line = chart.addSeries(LineSeries, {
          color: '#e6ff3a',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        const pts = [
          { time: a.time as UTCTimestamp, value: a.price },
          { time: time as UTCTimestamp, value: price },
        ].sort((x, y) => (x.time as number) - (y.time as number))
        line.setData(pts)
        drawingsRef.current.push(line)
        pendingRef.current = null
      }
    })

    return () => {
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volRef.current = null
      ema1Ref.current = null
      ema2Ref.current = null
      volMaRef.current = null
      rsiRef.current = null
      markersRef.current = null
      priceLineRef.current = null
      drawingsRef.current = []
      pendingRef.current = null
      fittedRef.current = false
    }
  }, [])

  // candle + volume data
  useEffect(() => {
    const cs = candleRef.current
    const vs = volRef.current
    if (!cs || !vs) return
    candlesRef.current = candles

    const lastClose = candles.length ? candles[candles.length - 1].close : 1
    cs.applyOptions({
      priceFormat: { type: 'custom', formatter: (p: number) => formatPrice(p), minMove: minMoveFor(lastClose) },
    })
    cs.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })))
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
  }, [candles])

  // EMA overlays
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (showEma) {
      ema1Ref.current = chart.addSeries(LineSeries, { color: '#e6ff3a', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      ema2Ref.current = chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      applyIndicators()
    } else {
      if (ema1Ref.current) { chart.removeSeries(ema1Ref.current); ema1Ref.current = null }
      if (ema2Ref.current) { chart.removeSeries(ema2Ref.current); ema2Ref.current = null }
    }
  }, [showEma])

  // Volume moving average
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (showVolMa) {
      volMaRef.current = chart.addSeries(LineSeries, { color: '#e6ff3a', lineWidth: 1, priceScaleId: 'vol', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      applyIndicators()
    } else if (volMaRef.current) {
      chart.removeSeries(volMaRef.current)
      volMaRef.current = null
    }
  }, [showVolMa])

  // RSI in its own pane
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (showRsi) {
      const r = chart.addSeries(LineSeries, { color: '#c084fc', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, 1)
      r.createPriceLine({ price: 70, color: '#2a2c30', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70' })
      r.createPriceLine({ price: 30, color: '#2a2c30', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '30' })
      rsiRef.current = r
      try {
        chart.panes()[1]?.setHeight(120)
      } catch {
        /* pane sizing best-effort */
      }
      applyIndicators()
    } else if (rsiRef.current) {
      chart.removeSeries(rsiRef.current)
      rsiRef.current = null
    }
  }, [showRsi])

  // average-entry line
  useEffect(() => {
    const cs = candleRef.current
    if (!cs) return
    if (priceLineRef.current) {
      cs.removePriceLine(priceLineRef.current)
      priceLineRef.current = null
    }
    if (avgEntry && avgEntry > 0) {
      priceLineRef.current = cs.createPriceLine({
        price: avgEntry,
        color: '#9ca1a9',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'avg',
      })
    }
  }, [avgEntry])

  // trade markers
  useEffect(() => {
    const m = markersRef.current
    if (!m) return
    if (!candles.length) {
      m.setMarkers([])
      return
    }
    const times = candles.map((c) => c.time)
    const minT = times[0]
    const maxT = times[times.length - 1]
    const snapped: SeriesMarker<Time>[] = markers
      .filter((mk) => mk.time <= maxT + 1)
      .map((mk) => {
        let t = times[0]
        for (const ct of times) {
          if (ct <= mk.time) t = ct
          else break
        }
        if (mk.time < minT) t = minT
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
  }, [markers, candles])

  // draw mode flag (read by the persistent click handler)
  useEffect(() => {
    drawModeRef.current = drawMode
    if (!drawMode) pendingRef.current = null
    if (elRef.current) elRef.current.style.cursor = drawMode ? 'crosshair' : ''
  }, [drawMode])

  // clear drawings
  useEffect(() => {
    if (clearSignal === 0) return
    const chart = chartRef.current
    if (!chart) return
    drawingsRef.current.forEach((s) => chart.removeSeries(s))
    drawingsRef.current = []
    pendingRef.current = null
  }, [clearSignal])

  return (
    <div className="chart-host">
      <div ref={elRef} className="chart" />
      <div ref={legendRef} className="ohlc" />
    </div>
  )
}
