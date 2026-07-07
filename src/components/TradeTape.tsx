import { useMarket } from '../state/useMarket'
import { useTape } from '../state/useTape'
import { EXPLORER_TX } from '../api/blockscout'
import { formatUsd, formatQty, formatPrice } from '../lib/format'

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

function timeOf(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour12: false })
}

/**
 * Live time & sales for the active PulseX pair, with a buy/sell pressure bar
 * over the loaded window. Data: PulseX subgraphs (see api/pulsex.ts).
 */
export function TradeTape() {
  const chainId = useMarket((s) => s.activePair?.chainId)
  const trades = useTape((s) => s.trades)
  const loading = useTape((s) => s.loading)
  const error = useTape((s) => s.error)

  if (chainId !== 'pulsechain') {
    return (
      <div className="center-msg" style={{ height: 90 }}>
        Live tape covers PulseChain (PulseX) pairs only — other chains don't have a free trade feed.
      </div>
    )
  }
  if (loading && trades.length === 0) {
    return (
      <div className="tapeload">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    )
  }
  if (trades.length === 0) {
    return (
      <div className="center-msg" style={{ height: 90 }}>
        {error ? 'PulseX subgraph is not responding — the tape will resume automatically.' : 'No recent swaps in this pool.'}
      </div>
    )
  }

  let buyUsd = 0
  let sellUsd = 0
  for (const t of trades) {
    if (t.side === 'buy') buyUsd += t.valueUsd
    else sellUsd += t.valueUsd
  }
  const total = buyUsd + sellUsd
  const buyPct = total > 0 ? (buyUsd / total) * 100 : 50

  return (
    <div className="tape">
      <div className="pressure">
        <span className="up num">{buyPct.toFixed(0)}% buys</span>
        <div className="track">
          <div className="fill" style={{ width: `${buyPct}%` }} />
        </div>
        <span className="down num">{(100 - buyPct).toFixed(0)}%</span>
      </div>
      {trades.map((t) => (
        <a
          className="taperow"
          key={t.id}
          href={`${EXPLORER_TX.pulsechain}${t.txHash}`}
          target="_blank"
          rel="noreferrer"
          title={`${t.wallet} — view transaction`}
        >
          <span className={`side ${t.side === 'buy' ? 'b' : 's'}`}>{t.side === 'buy' ? 'B' : 'S'}</span>
          <span className="tval num">{formatUsd(t.valueUsd)}</span>
          <span className="tqty num muted">{formatQty(t.qtyToken)}</span>
          <span className="tpx num muted">@ {formatPrice(t.priceUsd)}</span>
          <span className="twho num">
            <span className="taddr">{shortAddr(t.wallet)}</span>
            <span className="ttime">{timeOf(t.ts)}</span>
          </span>
        </a>
      ))}
      <div className="tapefoot">PulseX subgraph · updates every 10s</div>
    </div>
  )
}
