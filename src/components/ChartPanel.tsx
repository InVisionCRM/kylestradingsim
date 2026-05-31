import { useEffect, useMemo, useRef, useState } from 'react'
import { useMarket } from '../state/useMarket'
import { useMarketData } from '../state/useMarketData'
import { useSim } from '../state/useSim'
import { useChartPrefs } from '../state/useChartPrefs'
import { INDICATORS } from '../chart/indicatorCatalog'
import { useVisibleCandles, useActiveTokenKey } from '../hooks/useDerived'
import { Chart, type ChartHandle, type ChartMarker, type OrderLine } from '../chart/Chart'
import { ReplayControls } from './ReplayControls'
import { useOrders } from '../state/useOrders'
import { useWallet } from '../state/useWallet'
import { priceAtTime } from '../lib/walletTrades'
import { formatQty } from '../lib/format'
import {
  IconCandles, IconLineChart, IconFullscreen, IconCamera, IconChevron,
  IconCursor, IconTrendline, IconHLine, IconRay, IconRect, IconTrash,
} from './icons'
import type { Timeframe } from '../types'
import type { JSX } from 'react'

const TFS: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d']
// Left-rail drawing tools → KLineChart built-in overlay names
const TOOLS: { id: string; title: string; overlay: string | null; icon: JSX.Element }[] = [
  { id: 'cursor', title: 'Cursor', overlay: null, icon: <IconCursor /> },
  { id: 'segment', title: 'Trend line', overlay: 'segment', icon: <IconTrendline /> },
  { id: 'horizontalStraightLine', title: 'Horizontal line', overlay: 'horizontalStraightLine', icon: <IconHLine /> },
  { id: 'rayLine', title: 'Ray', overlay: 'rayLine', icon: <IconRay /> },
  { id: 'rect', title: 'Rectangle', overlay: 'rect', icon: <IconRect /> },
  { id: 'fibonacciLine', title: 'Fibonacci retracement', overlay: 'fibonacciLine', icon: <span>Fib</span> },
  { id: 'priceLine', title: 'Price line', overlay: 'priceLine', icon: <span>—$</span> },
]

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="clock num" title="Local time">{now.toLocaleTimeString([], { hour12: false })}</span>
}

function IndicatorsMenu() {
  const indicators = useChartPrefs((s) => s.indicators)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const anyOn = Object.values(indicators).some(Boolean)
  const row = (i: { name: string; label: string }) => (
    <button key={i.name} className="ddrow" onClick={() => useChartPrefs.getState().toggleIndicator(i.name)}>
      <span className={`chk ${indicators[i.name] ? 'on' : ''}`} />
      {i.label}
    </button>
  )

  return (
    <div className="dd" ref={ref}>
      <button className={`ddbtn ${anyOn ? 'on' : ''}`} onClick={() => setOpen((o) => !o)}>
        <IconLineChart size={14} /> Indicators <IconChevron size={14} />
      </button>
      {open && (
        <div className="ddmenu scrollmenu">
          <div className="ddgroup">Price overlays</div>
          {INDICATORS.filter((i) => i.overlay).map(row)}
          <div className="ddgroup">Oscillators &amp; volume</div>
          {INDICATORS.filter((i) => !i.overlay).map(row)}
        </div>
      )}
    </div>
  )
}

export function ChartPanel() {
  const tf = useMarket((s) => s.timeframe)
  const mode = useSim((s) => s.mode)
  const loading = useMarketData((s) => s.loading)
  const error = useMarketData((s) => s.error)
  const candles = useVisibleCandles()
  const chartType = useChartPrefs((s) => s.chartType)
  const scaleMode = useChartPrefs((s) => s.scaleMode)
  const indicators = useChartPrefs((s) => s.indicators)

  const colRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ChartHandle>(null)
  const [tool, setTool] = useState('cursor')

  const account = useSim((s) => s.accounts[s.mode])
  const activeKey = useActiveTokenKey()
  const markers: ChartMarker[] = useMemo(() => {
    if (!activeKey) return []
    return account.trades
      .filter((t) => t.tokenKey === activeKey)
      .map((t) => ({
        time: t.ts,
        price: t.priceUsd,
        side: t.side,
        text: `${t.side === 'buy' ? '▲ BUY' : '▼ SELL'} ${formatQty(t.qtyToken)}`,
      }))
  }, [account.trades, activeKey])
  const avgEntry = activeKey ? account.positions[activeKey]?.avgEntryUsd ?? null : null

  const ordersAll = useOrders((s) => s.orders[mode] ?? [])
  const orderLines: OrderLine[] = useMemo(
    () => ordersAll.filter((o) => o.tokenKey === activeKey).map((o) => ({ id: o.id, price: o.price, kind: o.kind, side: o.side })),
    [ordersAll, activeKey],
  )

  // imported-wallet on-chain trades, priced approximately at each candle's close (live only)
  const rawCandles = useMarketData((s) => s.candles)
  const walletShow = useWallet((s) => s.showOverlay)
  const walletTrades = useWallet((s) => s.trades)
  const walletTradesFor = useWallet((s) => s.tradesFor)
  const walletTokenAddr = useMarket((s) => s.activePair?.baseToken.address?.toLowerCase() ?? null)
  const walletMarkers: ChartMarker[] = useMemo(() => {
    if (mode !== 'live' || !walletShow || !walletTokenAddr || walletTradesFor !== walletTokenAddr) return []
    if (!rawCandles.length) return []
    const out: ChartMarker[] = []
    for (const t of walletTrades) {
      const price = priceAtTime(rawCandles, t.ts)
      if (price == null || !(price > 0)) continue
      const label = t.kind === 'buy' ? '⊕ BUY' : t.kind === 'sell' ? '⊖ SELL' : '⇄ transfer'
      out.push({ time: t.ts, price, side: t.kind, text: `${label} ${formatQty(t.amount)}` })
    }
    return out
  }, [mode, walletShow, walletTrades, walletTradesFor, walletTokenAddr, rawCandles])

  const pickTool = (id: string, overlay: string | null) => {
    setTool(id)
    if (overlay) chartRef.current?.startDrawing(overlay)
  }
  const clearDrawings = () => {
    chartRef.current?.clearDrawings()
    setTool('cursor')
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else colRef.current?.requestFullscreen?.()
  }
  const savePng = () => {
    const url = chartRef.current?.screenshot()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `paperdex-chart-${Date.now()}.png`
    a.click()
  }

  return (
    <div className="col" ref={colRef}>
      <div className="tfbar">
        {TFS.map((t) => (
          <button key={t} className={`tf ${t === tf ? 'on' : ''}`} onClick={() => useMarket.getState().setTimeframe(t)}>
            {t}
          </button>
        ))}
        <span className="vline" />
        <div className="seg">
          <button className={chartType === 'candles' ? 'on' : ''} title="Candlesticks" onClick={() => useChartPrefs.getState().setChartType('candles')}>
            <IconCandles size={16} />
          </button>
          <button className={chartType === 'line' ? 'on' : ''} title="Line" onClick={() => useChartPrefs.getState().setChartType('line')}>
            <IconLineChart size={16} />
          </button>
        </div>
        <div className="tools">
          <IndicatorsMenu />
        </div>
      </div>

      <div className="chartrow">
        <div className="rail">
          {TOOLS.map((t) => (
            <button key={t.id} className={`tool ${tool === t.id ? 'on' : ''}`} title={t.title} onClick={() => pickTool(t.id, t.overlay)}>
              {t.icon}
            </button>
          ))}
          <span className="sep" />
          <button className="tool" title="Delete all drawings" onClick={clearDrawings}>
            <IconTrash />
          </button>
        </div>
        <div className="chartwrap">
          <Chart
            ref={chartRef}
            candles={candles}
            chartType={chartType}
            scaleMode={scaleMode}
            indicators={indicators}
            avgEntry={avgEntry}
            markers={markers}
            walletMarkers={walletMarkers}
            tokenKey={activeKey ?? ''}
            orders={orderLines}
            onOrderMove={(id, p) => useOrders.getState().updatePrice(mode, id, p)}
          />
          {loading && <div className="chart-overlay">Loading chart…</div>}
          {!loading && error && <div className="chart-overlay">{error}</div>}
          {!loading && !error && candles.length === 0 && <div className="chart-overlay">No chart data for this token.</div>}
        </div>
      </div>

      <div className="statusbar">
        <Clock />
        <span className="sb-spacer" />
        <button className={`sb ${scaleMode === 'log' ? 'on' : ''}`} title="Logarithmic scale" onClick={() => useChartPrefs.getState().setScaleMode('log')}>
          log
        </button>
        <button className={`sb ${scaleMode === 'percent' ? 'on' : ''}`} title="Percent scale" onClick={() => useChartPrefs.getState().setScaleMode('percent')}>
          %
        </button>
        <button className="sb ic" title="Fullscreen" onClick={toggleFullscreen}>
          <IconFullscreen size={15} />
        </button>
        <button className="sb ic" title="Save chart as PNG" onClick={savePng}>
          <IconCamera size={15} />
        </button>
      </div>

      {mode === 'replay' && <ReplayControls />}
    </div>
  )
}
