import { useMemo, useState } from 'react'
import { useMarket } from '../state/useMarket'
import { useMarketData } from '../state/useMarketData'
import { useSim } from '../state/useSim'
import { useChartPrefs } from '../state/useChartPrefs'
import { useVisibleCandles, useActiveTokenKey } from '../hooks/useDerived'
import { Chart, type ChartMarker } from '../chart/Chart'
import { ReplayControls } from './ReplayControls'
import { formatQty } from '../lib/format'
import type { Timeframe } from '../types'

const TFS: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d']

export function ChartPanel() {
  const tf = useMarket((s) => s.timeframe)
  const mode = useSim((s) => s.mode)
  const loading = useMarketData((s) => s.loading)
  const error = useMarketData((s) => s.error)
  const candles = useVisibleCandles()
  const activeKey = useActiveTokenKey()
  const account = useSim((s) => s.accounts[s.mode])
  const prefs = useChartPrefs()
  const [drawMode, setDrawMode] = useState(false)
  const [clearSignal, setClearSignal] = useState(0)

  const markers: ChartMarker[] = useMemo(() => {
    if (!activeKey) return []
    return account.trades
      .filter((t) => t.tokenKey === activeKey)
      .map((t) => ({ time: t.ts, side: t.side, text: `${t.side === 'buy' ? 'B' : 'S'} ${formatQty(t.qtyToken)}` }))
  }, [account.trades, activeKey])

  const avgEntry = activeKey ? account.positions[activeKey]?.avgEntryUsd ?? null : null

  return (
    <div className="col">
      <div className="tfbar">
        {TFS.map((t) => (
          <button key={t} className={`tf ${t === tf ? 'on' : ''}`} onClick={() => useMarket.getState().setTimeframe(t)}>
            {t}
          </button>
        ))}
        <div className="tools">
          <button className={`ind ${prefs.ema ? 'on' : ''}`} title="EMA 9 & 21" onClick={() => prefs.toggle('ema')}>
            EMA
          </button>
          <button className={`ind ${prefs.volMa ? 'on' : ''}`} title="Volume MA 20" onClick={() => prefs.toggle('volMa')}>
            VOL
          </button>
          <button className={`ind ${prefs.rsi ? 'on' : ''}`} title="RSI 14" onClick={() => prefs.toggle('rsi')}>
            RSI
          </button>
          <span className="vline" />
          <button
            className={`ind ${drawMode ? 'on' : ''}`}
            title="Draw trendline — click two points"
            onClick={() => setDrawMode((d) => !d)}
          >
            ✎ Draw
          </button>
          <button className="ind" title="Clear drawings" onClick={() => setClearSignal((c) => c + 1)}>
            Clear
          </button>
        </div>
      </div>
      <div className="chartwrap">
        <Chart
          candles={candles}
          markers={markers}
          avgEntry={avgEntry}
          showEma={prefs.ema}
          showVolMa={prefs.volMa}
          showRsi={prefs.rsi}
          drawMode={drawMode}
          clearSignal={clearSignal}
        />
        {loading && <div className="chart-overlay">Loading chart…</div>}
        {!loading && error && <div className="chart-overlay">{error}</div>}
        {!loading && !error && candles.length === 0 && <div className="chart-overlay">No chart data for this token.</div>}
      </div>
      {mode === 'replay' && <ReplayControls />}
    </div>
  )
}
