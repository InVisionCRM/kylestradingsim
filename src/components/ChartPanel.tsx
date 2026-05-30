import { useMemo } from 'react'
import { useMarket } from '../state/useMarket'
import { useMarketData } from '../state/useMarketData'
import { useSim } from '../state/useSim'
import { useVisibleCandles, useActiveTokenKey } from '../hooks/useDerived'
import { Chart, type ChartMarker } from '../chart/Chart'
import { ReplayControls } from './ReplayControls'
import { formatPrice, formatQty } from '../lib/format'
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

  const last = candles[candles.length - 1]

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
        <div className="tools" />
      </div>
      <div className="chartwrap">
        {last && (
          <div className="ohlc">
            <span>O <b>{formatPrice(last.open)}</b></span>
            <span>H <b>{formatPrice(last.high)}</b></span>
            <span>L <b>{formatPrice(last.low)}</b></span>
            <span>
              C <b className={last.close >= last.open ? 'up' : 'down'}>{formatPrice(last.close)}</b>
            </span>
          </div>
        )}
        <Chart candles={candles} markers={markers} avgEntry={avgEntry} />
        {loading && <div className="chart-overlay">Loading chart…</div>}
        {!loading && error && <div className="chart-overlay">{error}</div>}
        {!loading && !error && candles.length === 0 && <div className="chart-overlay">No chart data for this token.</div>}
      </div>
      {mode === 'replay' && <ReplayControls />}
    </div>
  )
}
