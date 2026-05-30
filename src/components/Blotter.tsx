import { useState } from 'react'
import { useSim } from '../state/useSim'
import { usePriceFor } from '../hooks/useDerived'
import { formatUsd, formatPrice, formatQty, formatPct, signClass } from '../lib/format'

export function Blotter() {
  const account = useSim((s) => s.accounts[s.mode])
  const mode = useSim((s) => s.mode)
  const priceFor = usePriceFor()
  const [tab, setTab] = useState<'trades' | 'positions'>('trades')

  const positions = Object.values(account.positions)

  return (
    <div className="blotter">
      <div className="btabs">
        <button className={tab === 'trades' ? 'on' : ''} onClick={() => setTab('trades')}>
          RECENT TRADES
        </button>
        <button className={tab === 'positions' ? 'on' : ''} onClick={() => setTab('positions')}>
          OPEN POSITIONS ({positions.length})
        </button>
      </div>
      <div className="tablewrap">
        {tab === 'trades' ? (
          account.trades.length === 0 ? (
            <div className="empty">No trades yet — place your first {mode} order from the panel on the right.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>SIDE</th>
                  <th>TOKEN</th>
                  <th>AMOUNT</th>
                  <th>PRICE</th>
                  <th>VALUE</th>
                  <th>FEE</th>
                  <th>MODE</th>
                </tr>
              </thead>
              <tbody>
                {account.trades.slice(0, 100).map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.ts * 1000).toLocaleTimeString()}</td>
                    <td>
                      <span className={`side ${t.side === 'buy' ? 'b' : 's'}`}>{t.side.toUpperCase()}</span>
                    </td>
                    <td className="lab">{t.symbol}</td>
                    <td>{formatQty(t.qtyToken)}</td>
                    <td>{formatPrice(t.priceUsd)}</td>
                    <td>{formatUsd(t.valueUsd)}</td>
                    <td>{formatUsd(t.feeUsd)}</td>
                    <td>{t.mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : positions.length === 0 ? (
          <div className="empty">No open positions.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>TOKEN</th>
                <th>QTY</th>
                <th>AVG ENTRY</th>
                <th>LAST</th>
                <th>VALUE</th>
                <th>UNREALIZED P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const px = priceFor(p.tokenKey) ?? p.avgEntryUsd
                const up = (px - p.avgEntryUsd) * p.qty
                const mv = p.qty * px
                const pct = p.avgEntryUsd && px ? (px / p.avgEntryUsd - 1) * 100 : 0
                return (
                  <tr key={p.tokenKey}>
                    <td className="lab">{p.symbol}</td>
                    <td>{formatQty(p.qty)}</td>
                    <td>{formatPrice(p.avgEntryUsd)}</td>
                    <td>{formatPrice(px)}</td>
                    <td>{formatUsd(mv)}</td>
                    <td className={signClass(up)}>
                      {formatUsd(up)} ({formatPct(pct)})
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
