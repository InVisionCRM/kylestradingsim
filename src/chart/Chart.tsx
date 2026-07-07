import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { init, dispose, CandleType, YAxisType, TooltipShowRule } from 'klinecharts'
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
  /** jump back to the newest bar (used when re-enabling follow) */
  scrollToLatest: () => void
}
export interface ChartMarker {
  time: number
  price: number
  side: 'buy' | 'sell' | 'transfer'
  text: string
}
export interface OrderLine {
  id: string
  price: number
  kind: 'limit' | 'stop' | 'tp' | 'sl'
  side: 'buy' | 'sell'
}
interface Props {
  candles: Candle[]
  chartType: ChartType
  scaleMode: ScaleMode
  indicators: Record<string, boolean>
  avgEntry: number | null
  markers: ChartMarker[]
  walletMarkers: ChartMarker[]
  tokenKey: string
  orders: OrderLine[]
  onOrderMove: (id: string, price: number) => void
  /** true = follow new bars at the right edge; false = hold position while data streams in */
  follow: boolean
  /** true = always show the OHLCV legend; false = only while the crosshair is active */
  legend: boolean
}

// overlay groups so "Clear" only removes user drawings, never markers / avg / order lines
const G_USER = 'pdx-user'
const G_POS = 'pdx-pos'
const G_TRADES = 'pdx-trades'
const G_ORDERS = 'pdx-orders'
const G_WALLET = 'pdx-wallet'

const CANDLE_PANE = 'candle_pane'

function toKLine(cs: Candle[]): KLineData[] {
  return cs.map((c) => ({ timestamp: c.time * 1000, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }))
}

function themeStyles(chartType: ChartType, scaleMode: ScaleMode, legend: boolean): DeepPartial<Styles> {
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
      tooltip: { showRule: legend ? TooltipShowRule.Always : TooltipShowRule.FollowCross, text: { color: text } },
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
    indicator: { tooltip: { showRule: legend ? TooltipShowRule.Always : TooltipShowRule.FollowCross, text: { color: text } } },
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
  { candles, chartType, scaleMode, indicators, avgEntry, markers, walletMarkers, tokenKey, orders, onOrderMove, follow, legend },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<KLineChartApi | null>(null)
  const candlesRef = useRef<Candle[]>([])
  const paneIds = useRef<Record<string, string>>({})
  const selectedRef = useRef<string | null>(null)
  const draggingRef = useRef(false)
  const followRef = useRef(follow)
  followRef.current = follow
  /** true while the user has a finger/button down on the chart — pauses programmatic scrolling */
  const interactingRef = useRef(false)

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
    scrollToLatest: () => chartRef.current?.scrollToRealTime(),
  }))

  // init once
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    // decimalFoldThreshold folds long zero-runs into compact 0.0ₙ123 form for memecoin prices.
    const chart = init(el, { styles: themeStyles(chartType, scaleMode, legend), decimalFoldThreshold: 3 })
    chartRef.current = chart
    // debugging handle for automated tests / console poking
    ;(window as unknown as { __pdxChart?: unknown }).__pdxChart = chart
    // ResizeObserver (not window resize) so the chart also re-measures when its
    // container changes — fullscreen, mobile tab switches, drawer toggles.
    const ro = new ResizeObserver(() => chartRef.current?.resize())
    ro.observe(el)
    return () => {
      ro.disconnect()
      dispose(el)
      chartRef.current = null
      paneIds.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // data + price precision (so sub-penny memecoin prices aren't rounded to 0.00)
  const precisionRef = useRef(0)
  useEffect(() => {
    const prev = candlesRef.current
    candlesRef.current = candles
    const chart = chartRef.current
    if (!chart) return
    const last = candles.length ? candles[candles.length - 1].close : 1
    const precision = last >= 1 ? 4 : last >= 0.01 ? 6 : last >= 0.0001 ? 8 : 10
    if (precision !== precisionRef.current) {
      precisionRef.current = precision
      chart.setPriceVolumePrecision(precision, 2)
    }

    // A full applyNewData RESETS the viewport (scroll + zoom snap to the newest
    // bar), which yanks the chart out from under anyone studying history. So we
    // detect the three incremental shapes our stores produce — same-array-object
    // identity of the shared elements proves the series wasn't replaced — and
    // route them through viewport-preserving APIs. Full rebuilds only remain for
    // genuine dataset swaps (token/timeframe change, replay scrub).
    const n = candles.length
    const k = n - prev.length
    let handled = false
    if (prev.length > 0 && n > 0) {
      if (k === 0 && n > 1 && candles[n - 2] === prev[n - 2] && candles[n - 1] !== prev[n - 1]) {
        // live poll rewrote the last bar
        chart.updateData(toKLine([candles[n - 1]])[0])
        handled = true
      } else if (k === 1 && n > 1 && candles[n - 2] === prev[n - 2]) {
        // replay tick appended one bar
        const before = chart.getVisibleRange()
        chart.updateData(toKLine([candles[n - 1]])[0])
        if (!followRef.current && !interactingRef.current) {
          // hold the view still even at the right edge — new bars accumulate
          // off-screen. klinecharts already anchors when scrolled into history
          // (realTo unchanged); when the view followed, shift back exactly one
          // bar width. (scrollByDistance(+d) reduces the right-edge offset.)
          // Skipped mid-drag: scrollByDistance rebases the drag baseline and
          // would make the chart lurch under the user's finger.
          const after = chart.getVisibleRange()
          if (after.realTo !== before.realTo) chart.scrollByDistance(chart.getBarSpace(), 0)
        }
        handled = true
      } else if (k > 0 && candles[k] === prev[0]) {
        // deep-history page prepended older bars; klinecharts keeps the view
        // anchored to the newest bar for Forward loads, so nothing moves
        chart.applyMoreData(toKLine(candles.slice(0, k)), false)
        if (candles[n - 1] !== prev[prev.length - 1]) chart.updateData(toKLine([candles[n - 1]])[0])
        handled = true
      }
    }
    if (!handled) chart.applyNewData(toKLine(candles))
  }, [candles])

  // ── Gesture layer (capture phase on the wrapper, ahead of klinecharts) ──
  //
  // 1. Two-finger pinch: we own it entirely. klinecharts' native pinch anchors
  //    at the stale start-midpoint, ignores midpoint movement, and — worse — if
  //    one finger lands on the price axis it degrades into a one-finger PAN,
  //    which is the "zoom randomly jumps the chart" bug. Ours zooms around the
  //    live midpoint (absolute scale from gesture start, so it can't compound
  //    or drift) and pans with the midpoint, TradingView-style.
  // 2. Price-axis strip: wheel or vertical drag scales the candles vertically
  //    (candle pane gap — v9 has no native y-zoom); double-click/tap resets.
  // 3. Everything else passes through to klinecharts untouched.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const AXIS_W = 56
    const XAXIS_H = 28

    let vScale = 1
    const clampGap = (v: number) => Math.min(0.47, Math.max(0.01, v))
    const applyVScale = (next: number) => {
      vScale = Math.min(6, Math.max(0.05, next))
      chartRef.current?.setPaneOptions({
        id: CANDLE_PANE,
        gap: { top: clampGap(0.2 * vScale), bottom: clampGap(0.1 * vScale) },
      })
    }
    const inAxis = (clientX: number, clientY: number): boolean => {
      const r = host.getBoundingClientRect()
      return clientX > r.right - AXIS_W && clientX <= r.right && clientY >= r.top && clientY < r.bottom - XAXIS_H
    }

    let ydrag: { y: number; scale: number } | null = null
    let pinch: { dist: number; bar: number; midX: number } | null = null
    // once we own a multi-touch gesture, swallow the rest of it so klinecharts
    // never sees a half-gesture (its half-processed state is what causes jumps)
    let latch = false
    let lastAxisTap = 0

    const touchDist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const own = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const onWheel = (e: WheelEvent) => {
      if (!inAxis(e.clientX, e.clientY)) return
      own(e)
      applyVScale(vScale * Math.exp(e.deltaY * 0.0012))
    }

    const onTouchStart = (e: TouchEvent) => {
      interactingRef.current = true
      if (e.touches.length >= 2) {
        ydrag = null
        const [a, b] = [e.touches[0], e.touches[1]]
        const r = host.getBoundingClientRect()
        pinch = { dist: touchDist(a, b), bar: chartRef.current?.getBarSpace() ?? 8, midX: (a.clientX + b.clientX) / 2 - r.left }
        latch = true
        own(e)
      } else if (e.touches.length === 1 && inAxis(e.touches[0].clientX, e.touches[0].clientY)) {
        const now = Date.now()
        if (now - lastAxisTap < 300) {
          applyVScale(1) // double-tap resets
          lastAxisTap = 0
        } else {
          lastAxisTap = now
        }
        ydrag = { y: e.touches[0].clientY, scale: vScale }
        latch = true
        own(e)
      } else if (latch) {
        own(e)
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      const chart = chartRef.current
      if (pinch && e.touches.length >= 2 && chart) {
        const [a, b] = [e.touches[0], e.touches[1]]
        const r = host.getBoundingClientRect()
        const dist = touchDist(a, b)
        const midX = (a.clientX + b.clientX) / 2 - r.left
        const cur = chart.getBarSpace()
        const desired = pinch.bar * (dist / pinch.dist)
        const ratio = desired / cur
        if (Math.abs(ratio - 1) > 0.002) chart.zoomAtCoordinate(ratio, { x: midX, y: 0 }, 0)
        const dMid = midX - pinch.midX
        if (Math.abs(dMid) > 0.5) chart.scrollByDistance(dMid, 0)
        pinch.midX = midX
        own(e)
      } else if (ydrag && e.touches.length === 1) {
        applyVScale(ydrag.scale * Math.exp((e.touches[0].clientY - ydrag.y) * -0.006))
        own(e)
      } else if (latch) {
        own(e)
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        interactingRef.current = false
        const owned = latch
        pinch = null
        ydrag = null
        latch = false
        if (owned) e.stopPropagation()
      } else if (latch) {
        if (e.touches.length < 2) pinch = null
        e.stopPropagation()
      }
    }

    // desktop: drag on the price axis scales vertically; dblclick resets
    let mdrag: { y: number; scale: number } | null = null
    const onMouseMoveWin = (e: MouseEvent) => {
      if (mdrag) applyVScale(mdrag.scale * Math.exp((e.clientY - mdrag.y) * -0.006))
    }
    const onMouseUpWin = () => {
      mdrag = null
      interactingRef.current = false
      window.removeEventListener('mousemove', onMouseMoveWin)
      window.removeEventListener('mouseup', onMouseUpWin)
    }
    const onMouseDown = (e: MouseEvent) => {
      interactingRef.current = true
      window.addEventListener('mouseup', onMouseUpWin)
      if (e.button === 0 && inAxis(e.clientX, e.clientY)) {
        mdrag = { y: e.clientY, scale: vScale }
        window.addEventListener('mousemove', onMouseMoveWin)
        own(e)
      }
    }
    const onDblClick = (e: MouseEvent) => {
      if (!inAxis(e.clientX, e.clientY)) return
      own(e)
      applyVScale(1)
    }

    host.addEventListener('wheel', onWheel, { capture: true, passive: false })
    host.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
    host.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    host.addEventListener('touchend', onTouchEnd, { capture: true })
    host.addEventListener('touchcancel', onTouchEnd, { capture: true })
    host.addEventListener('mousedown', onMouseDown, { capture: true })
    host.addEventListener('dblclick', onDblClick, { capture: true })
    return () => {
      host.removeEventListener('wheel', onWheel, { capture: true })
      host.removeEventListener('touchstart', onTouchStart, { capture: true })
      host.removeEventListener('touchmove', onTouchMove, { capture: true })
      host.removeEventListener('touchend', onTouchEnd, { capture: true })
      host.removeEventListener('touchcancel', onTouchEnd, { capture: true })
      host.removeEventListener('mousedown', onMouseDown, { capture: true })
      host.removeEventListener('dblclick', onDblClick, { capture: true })
      window.removeEventListener('mousemove', onMouseMoveWin)
      window.removeEventListener('mouseup', onMouseUpWin)
    }
  }, [])

  // theme: candle type + scale mode + legend visibility
  useEffect(() => {
    chartRef.current?.setStyles(themeStyles(chartType, scaleMode, legend))
  }, [chartType, scaleMode, legend])

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

  // imported-wallet on-chain trades — own group, distinct cyan/amber so they read
  // separately from your own (green/red) paper-trade markers
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !hasData) return
    chart.removeOverlay({ groupId: G_WALLET })
    walletMarkers.forEach((m) => {
      chart.createOverlay({
        name: 'simpleAnnotation',
        groupId: G_WALLET,
        lock: true,
        points: [{ timestamp: m.time * 1000, value: m.price }],
        extendData: m.text,
        styles: {
          text: {
            color: m.side === 'transfer' ? '#cbd5e1' : '#ffffff',
            size: 12,
            weight: 'bold',
            backgroundColor:
              m.side === 'buy' ? '#16a34a' : m.side === 'sell' ? '#dc2626' : 'rgba(71, 85, 105, 0.55)',
            borderColor: m.side === 'buy' ? '#16a34a' : m.side === 'sell' ? '#dc2626' : 'rgba(100, 116, 139, 0.6)',
            borderSize: 0,
            borderRadius: 4,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 3,
            paddingBottom: 3,
          },
        },
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletMarkers, hasData])

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

  // draggable order lines (limit = indigo, stop = amber, TP = mint, SL = red)
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || draggingRef.current) return
    chart.removeOverlay({ groupId: G_ORDERS })
    orders.forEach((o) => {
      const color = o.kind === 'tp' ? '#2ee6a6' : o.kind === 'sl' ? '#f87171' : o.kind === 'stop' ? '#fbbf24' : '#6366f1'
      chart.createOverlay({
        name: 'priceLine',
        groupId: G_ORDERS,
        points: [{ value: o.price }],
        styles: { line: { color } },
        onPressedMoveStart: () => {
          draggingRef.current = true
          return false
        },
        onPressedMoveEnd: (e) => {
          draggingRef.current = false
          const v = e.overlay.points[0]?.value
          if (typeof v === 'number' && v > 0) onOrderMove(o.id, v)
          return false
        },
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders])

  return (
    <div className="chart-host" ref={hostRef}>
      <div ref={elRef} className="chart" />
    </div>
  )
})
