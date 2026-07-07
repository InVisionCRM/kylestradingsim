import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSim } from '../state/useSim'
import { useUi } from '../state/useUi'
import { useMarket } from '../state/useMarket'
import { usePriceFor } from '../hooks/useDerived'
import { getPair } from '../api/dexscreener'
import { computeAnalytics } from '../sim/analytics'
import { formatUsd, formatPrice, formatQty, formatPct, signClass } from '../lib/format'
import { TokenIcon } from '../components/TokenIcon'

const IconShare = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7 8l5-5 5 5M5 15v4h14v-4" />
  </svg>
)

async function goToToken(chainId: string, pairAddress: string) {
  const p = await getPair(chainId, pairAddress).catch(() => null)
  if (p) {
    useMarket.getState().setActivePair(p)
    useUi.getState().setMobileTab('chart')
  }
}

/** Positions tab: best-trade flex banner, position cards, recent trades — tables don't fit a phone. */
export function MobilePositions() {
  const account = useSim((s) => s.accounts[s.mode])
  const mode = useSim((s) => s.mode)
  const priceFor = usePriceFor()
  const [confirm, setConfirm] = useState(false)

  const analytics = useMemo(() => computeAnalytics(account), [account])
  const best = useMemo(() => {
    let top = null
    for (const c of analytics.closed) {
      if (c.pnlUsd > 0 && (!top || c.returnPct > top.returnPct)) top = c
    }
    return top
  }, [analytics])

  const positions = Object.values(account.positions)
  const trades = account.trades.slice(0, 30)

  return (
    <div className="col scroll">
      {best && (
        <div className="flexhero">
          <span className="big num">{formatPct(best.returnPct)}</span>
          <span className="rs">
            <span className="k">BEST TRADE</span>
            <div className="t">
              {best.symbol} · closed{' '}
              {new Date(best.ts * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </div>
          </span>
          <button
            className="sharebtn"
            onClick={() =>
              useUi.getState().openFlex({
                symbol: best.symbol,
                roiPct: best.returnPct,
                pnlUsd: best.pnlUsd,
                entryUsd: best.avgEntry,
                markUsd: best.exit,
                closed: true,
              })
            }
          >
            {IconShare}
            FLEX IT
          </button>
        </div>
      )}

      <div className="sechead">
        OPEN POSITIONS ({positions.length})
        <button onClick={() => setConfirm(true)}>RESET {mode.toUpperCase()}</button>
      </div>
      {positions.length === 0 && (
        <div className="center-msg" style={{ height: 80 }}>
          No open positions — hit BUY on the chart tab.
        </div>
      )}
      {positions.map((p) => {
        const px = priceFor(p.tokenKey) ?? p.avgEntryUsd
        const up = (px - p.avgEntryUsd) * p.qty
        const pct = p.avgEntryUsd > 0 ? (px / p.avgEntryUsd - 1) * 100 : 0
        return (
          <div className="pcard" key={p.tokenKey} onClick={() => goToToken(p.chainId, p.pairAddress)}>
            <div className="top">
              <TokenIcon symbol={p.symbol} src={p.imageUrl} tokenKey={p.tokenKey} size={30} cls="ic" />
              <span className="s">{p.symbol}</span>
              <span className={`num ${signClass(up)}`} style={{ fontWeight: 600 }}>
                {formatUsd(up)}
              </span>
              <button
                className="sharebtn iconly"
                aria-label={`Share ${p.symbol} P&L card`}
                onClick={(e) => {
                  e.stopPropagation()
                  useUi.getState().openFlex({
                    symbol: p.symbol,
                    roiPct: pct,
                    pnlUsd: up,
                    entryUsd: p.avgEntryUsd,
                    markUsd: px,
                    closed: false,
                  })
                }}
              >
                {IconShare}
              </button>
            </div>
            <div className="grid num">
              <span>
                <span className="k">QTY</span>
                <br />
                {formatQty(p.qty)}
              </span>
              <span>
                <span className="k">AVG ENTRY</span>
                <br />
                {formatPrice(p.avgEntryUsd)}
              </span>
              <span>
                <span className="k">VALUE</span>
                <br />
                {formatUsd(p.qty * px)}
              </span>
              <span>
                <span className="k">P&amp;L</span>
                <br />
                <span className={signClass(up)}>{formatPct(pct)}</span>
              </span>
            </div>
          </div>
        )
      })}

      <div className="sechead">RECENT TRADES</div>
      {trades.length === 0 && (
        <div className="center-msg" style={{ height: 60 }}>
          No trades yet.
        </div>
      )}
      {trades.map((t) => (
        <div className="trrow" key={t.id}>
          <span className={`side ${t.side === 'buy' ? 'b' : 's'}`}>{t.side.toUpperCase()}</span>
          <span className="tsy">{t.symbol}</span>
          <span className="tmeta">
            <span className="t1 num">
              {formatQty(t.qtyToken)} @ {formatPrice(t.priceUsd)}
            </span>
            <span className="t2 num">
              {new Date(t.ts * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · fee{' '}
              {formatUsd(t.feeUsd)}
            </span>
          </span>
        </div>
      ))}
      <div style={{ height: 14 }} />

      {confirm &&
        createPortal(
          <div className="confirm-overlay" onClick={() => setConfirm(false)}>
          <div className="confirm" onClick={(e) => e.stopPropagation()}>
            <h3>Reset {mode} account?</h3>
            <p>
              Clears your {mode} positions and trade history and restores the $
              {account.startingBalanceUsd.toLocaleString()} starting balance. Your other account is untouched.
            </p>
            <div className="actions">
              <button onClick={() => setConfirm(false)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  useSim.getState().reset(mode)
                  setConfirm(false)
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </div>
  )
}
