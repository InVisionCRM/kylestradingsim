import { useEffect, useMemo, useRef, useState } from 'react'
import { useMarket } from '../state/useMarket'
import { useMarketData } from '../state/useMarketData'
import { useSim } from '../state/useSim'
import { useChartPrefs, type IndicatorKey } from '../state/useChartPrefs'
import { useVisibleCandles, useActiveTokenKey } from '../hooks/useDerived'
import { Chart, type ChartMarker, type ChartHandle } from '../chart/Chart'
import { ReplayControls } from './ReplayControls'
import { formatQty } from '../lib/format'
import { IconCandles, IconLineChart, IconFullscreen, IconCamera, IconChevron } from './icons'
import type { Timeframe } from '../types'

const TFS: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d']
const INDICATORS: { key: IndicatorKey; label: string }[] = [
  { key: 'ema', label: 'EMA (9, 21)' },
  { key: 'sma', label: 'SMA (50)' },
  { key: 'bb', label: 'Bollinger Bands (20, 2)' },
  { key: 'vwap', label: 'VWAP' },
  { key: 'rsi', label: 'RSI (14)' },
  { key: 'volMa', label: 'Volume MA (20)' },
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
  const prefs = useChartPrefs()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const anyOn = INDICATORS.some((i) => prefs[i.key])
  return (
    <div className="dd" ref={ref}>
      <button className={`ddbtn ${anyOn ? 'on' : ''}`} onClick={() => setOpen((o) => !o)}>
        <IconLineChart size={14} /> Indicators <IconChevron size={14} />
      </button>
      {open && (
        <div className="ddmenu">
          {INDICATORS.map((i) => (
            <button key={i.key} className="ddrow" onClick={() => prefs.toggle(i.key)}>
              <span className={`chk ${prefs[i.key] ? 'on' : ''}`} />
              {i.label}
            </button>
          ))}
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
  const activeKey = useActiveTokenKey()
  const account = useSim((s) => s.accounts[s.mode])
  const chartType = useChartPrefs((s) => s.chartType)
  const scaleMode = useChartPrefs((s) => s.scaleMode)
  const prefs = useChartPrefs()

  const colRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ChartHandle>(null)
  const [isFs, setIsFs] = useState(false)

  const indicators = useMemo(
    () => ({ ema: prefs.ema, sma: prefs.sma, bb: prefs.bb, vwap: prefs.vwap, rsi: prefs.rsi, volMa: prefs.volMa }),
    [prefs.ema, prefs.sma, prefs.bb, prefs.vwap, prefs.rsi, prefs.volMa],
  )

  const markers: ChartMarker[] = useMemo(() => {
    if (!activeKey) return []
    return account.trades
      .filter((t) => t.tokenKey === activeKey)
      .map((t) => ({ time: t.ts, side: t.side, text: `${t.side === 'buy' ? 'B' : 'S'} ${formatQty(t.qtyToken)}` }))
  }, [account.trades, activeKey])

  const avgEntry = activeKey ? account.positions[activeKey]?.avgEntryUsd ?? null : null

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else colRef.current?.requestFullscreen?.()
  }

  const savePng = () => {
    const canvas = chartRef.current?.takeScreenshot()
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `paperdex-chart-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    })
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
          <button
            className={chartType === 'candles' ? 'on' : ''}
            title="Candlesticks"
            onClick={() => useChartPrefs.getState().setChartType('candles')}
          >
            <IconCandles size={16} />
          </button>
          <button
            className={chartType === 'line' ? 'on' : ''}
            title="Line"
            onClick={() => useChartPrefs.getState().setChartType('line')}
          >
            <IconLineChart size={16} />
          </button>
        </div>
        <div className="tools">
          <IndicatorsMenu />
        </div>
      </div>

      <div className="chartwrap">
        <Chart
          ref={chartRef}
          candles={candles}
          markers={markers}
          avgEntry={avgEntry}
          chartType={chartType}
          scaleMode={scaleMode}
          indicators={indicators}
        />
        {loading && <div className="chart-overlay">Loading chart…</div>}
        {!loading && error && <div className="chart-overlay">{error}</div>}
        {!loading && !error && candles.length === 0 && <div className="chart-overlay">No chart data for this token.</div>}
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
        <button className={`sb ic ${isFs ? 'on' : ''}`} title="Fullscreen" onClick={toggleFullscreen}>
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
