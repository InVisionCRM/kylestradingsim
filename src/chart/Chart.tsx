import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
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
import { formatPrice } from '../lib/format'

export interface ChartMarker {
  time: number
  side: 'buy' | 'sell'
  text: string
}

interface Props {
  candles: Candle[]
  markers: ChartMarker[]
  avgEntry: number | null
}

function minMoveFor(price: number): number {
  if (price >= 1) return 0.0001
  if (price >= 0.01) return 0.000001
  if (price >= 0.0001) return 1e-8
  return 1e-12
}

export function Chart({ candles, markers, avgEntry }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const priceLineRef = useRef<IPriceLine | null>(null)
  const fittedRef = useRef(false)

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
        vertLine: { color: '#3a3c40', labelBackgroundColor: '#2a2c30', width: 1, style: LineStyle.Dotted },
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

    return () => {
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volRef.current = null
      markersRef.current = null
      priceLineRef.current = null
      fittedRef.current = false
    }
  }, [])

  // candle + volume data
  useEffect(() => {
    const cs = candleRef.current
    const vs = volRef.current
    if (!cs || !vs) return

    const lastClose = candles.length ? candles[candles.length - 1].close : 1
    cs.applyOptions({
      priceFormat: { type: 'custom', formatter: (p: number) => formatPrice(p), minMove: minMoveFor(lastClose) },
    })

    cs.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    )
    vs.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(74,222,128,0.32)' : 'rgba(248,113,113,0.32)',
      })),
    )

    if (!fittedRef.current && candles.length) {
      chartRef.current?.timeScale().fitContent()
      fittedRef.current = true
    }
  }, [candles])

  // trade markers (snapped to candle times within range)
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

  // average-entry price line
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

  return <div ref={elRef} className="chart" />
}
