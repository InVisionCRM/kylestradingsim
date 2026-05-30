import { useEffect, useMemo, useState } from 'react'
import { useUi } from '../state/useUi'
import { useSim } from '../state/useSim'
import { computeAnalytics } from '../sim/analytics'
import { useCountUp } from '../lib/useCountUp'
import { AreaCurve, Donut, HBars, DistBars } from './StatCharts'
import { formatUsd, formatPct, formatPrice, formatQty } from '../lib/format'
import type { Mode } from '../types'

function sign(v: number): 'up' | 'down' | '' {
  return v > 0 ? 'up' : v < 0 ? 'down' : ''
}
function fmtDur(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`
  return `${Math.floor(sec / 86400)}d ${Math.round((sec % 86400) / 3600)}h`
}

function StatCard({
  label,
  value,
  format,
  sub,
  cls,
  override,
}: {
  label: string
  value: number
  format: (n: number) => string
  sub?: string
  cls?: string
  override?: string
}) {
  const v = useCountUp(value)
  return (
    <div className="dcard reveal">
      <div className="k">{label}</div>
      <div className={`v num ${cls ?? ''}`}>{override ?? format(v)}</div>
      {sub !== undefined && <div className="s num">{sub}</div>}
    </div>
  )
}

export function Dashboard() {
  const open = useUi((s) => s.analyticsOpen)
  const close = useUi((s) => s.closeAnalytics)
  const mode = useSim((s) => s.mode)
  const accounts = useSim((s) => s.accounts)
  const [acct, setAcct] = useState<Mode>(mode)

  useEffect(() => {
    if (open) setAcct(mode)
  }, [open, mode])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const a = useMemo(() => computeAnalytics(accounts[acct]), [accounts, acct])

  if (!open) return null

  return (
    <div className="dashov" onClick={close}>
      <div className="dash" onClick={(e) => e.stopPropagation()}>
        <div className="dhead">
          <h1>Performance</h1>
          <div className="seg2">
            <button className={acct === 'live' ? 'on' : ''} onClick={() => setAcct('live')}>
              Live
            </button>
            <button className={acct === 'replay' ? 'on' : ''} onClick={() => setAcct('replay')}>
              Replay
            </button>
          </div>
          <button className="dx" onClick={close} title="Close (Esc)">
            ✕
          </button>
        </div>

        {!a.hasData ? (
          <div className="dempty">
            No closed trades on your <b>{acct}</b> account yet.
            <br />
            Close a position and your performance will show up here.
          </div>
        ) : (
          <div className="dscroll">
            <div className="dcards">
              <StatCard label="Net P&L" value={a.realizedPnl} format={formatUsd} cls={sign(a.realizedPnl)} sub={formatPct(a.realizedPct)} />
              <StatCard label="Win rate" value={a.winRate} format={(n) => `${n.toFixed(1)}%`} sub={`${a.wins} W / ${a.losses} L`} />
              <StatCard label="Profit factor" value={a.profitFactor} format={(n) => n.toFixed(2)} override={!isFinite(a.profitFactor) ? '∞' : undefined} sub="gross win / loss" />
              <StatCard label="Closed trades" value={a.closed.length} format={(n) => `${Math.round(n)}`} sub={`${a.buyCount} buys · ${a.sellCount} sells`} />
              <StatCard label="Avg win" value={a.avgWin} format={formatUsd} cls="up" sub={`best ${formatUsd(a.largestWin)}`} />
              <StatCard label="Avg loss" value={a.avgLoss} format={formatUsd} cls="down" sub={`worst ${formatUsd(a.largestLoss)}`} />
              <StatCard label="Max drawdown" value={a.maxDrawdown} format={formatUsd} cls="down" sub={formatPct(a.maxDrawdownPct)} />
              <StatCard label="Avg hold" value={a.avgHoldSec} format={() => fmtDur(a.avgHoldSec)} override={fmtDur(a.avgHoldSec)} sub={`fees ${formatUsd(a.totalFees)}`} />
            </div>

            <div className="dpanel">
              <div className="dt">
                <span>Cumulative P&L</span>
                <span className={`num ${sign(a.realizedPnl)}`}>{formatUsd(a.realizedPnl)}</span>
              </div>
              <AreaCurve data={a.curve.map((p) => p.cum)} />
            </div>

            <div className="dtwo">
              <div className="dpanel">
                <div className="dt"><span>Win / loss</span></div>
                <Donut wins={a.wins} losses={a.losses} />
                <div className="dlegend">
                  <span><i style={{ background: '#2ee6a6' }} />Wins {a.wins}</span>
                  <span><i style={{ background: '#f87171' }} />Losses {a.losses}</span>
                </div>
              </div>
              <div className="dpanel">
                <div className="dt"><span>P&L by token</span></div>
                <HBars items={a.byToken.map((t) => ({ label: t.symbol, value: t.pnl }))} />
              </div>
            </div>

            <div className="dpanel">
              <div className="dt"><span>P&L per trade</span><span style={{ color: 'var(--faint)' }}>{a.closed.length} closed</span></div>
              <DistBars values={a.closed.slice().reverse().map((c) => c.pnlUsd)} />
            </div>

            <div className="dpanel">
              <div className="dt"><span>Closed trades</span></div>
              <div className="dtablewrap">
                <table className="dtable">
                  <thead>
                    <tr><th>TIME</th><th>TOKEN</th><th>QTY</th><th>ENTRY</th><th>EXIT</th><th>P&L</th></tr>
                  </thead>
                  <tbody>
                    {a.closed.slice(0, 50).map((c, i) => (
                      <tr key={i}>
                        <td>{new Date(c.ts * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="lab">{c.symbol}</td>
                        <td>{formatQty(c.qty)}</td>
                        <td>{formatPrice(c.avgEntry)}</td>
                        <td>{formatPrice(c.exit)}</td>
                        <td className={sign(c.pnlUsd)}>
                          {formatUsd(c.pnlUsd)} ({formatPct(c.returnPct)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
