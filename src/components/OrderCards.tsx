import { useMarket } from '../state/useMarket'
import { useSim } from '../state/useSim'
import { useOrders } from '../state/useOrders'
import { usePriceFor } from '../hooks/useDerived'
import { getPair } from '../api/dexscreener'
import { triggerDir, orderLabel } from '../sim/orders'
import { TokenIcon } from './TokenIcon'
import { formatPrice, formatUsd, formatQty } from '../lib/format'
import type { PendingOrder } from '../types'

const NO_ORDERS: PendingOrder[] = []

/** Above this % gap the proximity meter reads empty. */
const METER_RANGE_PCT = 15

async function goToToken(chainId: string, pairAddress: string) {
  const p = await getPair(chainId, pairAddress).catch(() => null)
  if (p) useMarket.getState().setActivePair(p)
}

function OrderCard({ o, priceNow }: { o: PendingOrder; priceNow: number | null }) {
  const dir = triggerDir(o)
  const hasPx = priceNow != null && priceNow > 0 && o.price > 0
  // how far price still has to travel to hit the trigger, as % of current price
  // (negative = already crossed, the engine is about to fill it)
  const gapPct = hasPx ? (((dir === 'above' ? o.price - priceNow : priceNow - o.price) as number) / priceNow) * 100 : null
  const ready = gapPct != null && gapPct <= 0
  const closeness = gapPct == null ? 0 : ready ? 1 : Math.max(0, Math.min(1, 1 - gapPct / METER_RANGE_PCT))
  const near = !ready && closeness > 0.85

  const size =
    o.sizeUsd != null ? formatUsd(o.sizeUsd) : o.sizeToken != null ? `${formatQty(o.sizeToken)} ${o.symbol}` : 'Close position'
  const placed = new Date(o.createdTs * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={`ocard ${ready ? 'ready' : near ? 'near' : ''}`}
      onClick={() => goToToken(o.chainId, o.pairAddress)}
      title="View on chart — order lines are draggable there"
    >
      <div className="otop">
        <span className={`okind ${o.kind}`}>{orderLabel(o)}</span>
        <TokenIcon symbol={o.symbol} src={o.imageUrl} tokenKey={o.tokenKey} size={22} cls="ic" />
        <span className="osym">{o.symbol}</span>
        <button
          className="ocancel"
          title="Cancel order"
          onClick={(e) => {
            e.stopPropagation()
            useOrders.getState().cancel(o.mode, o.id)
          }}
        >
          ×
        </button>
      </div>

      <div className="oprices num">
        <span>
          <i>TRIGGER</i>
          {formatPrice(o.price)}
        </span>
        <span>
          <i>NOW</i>
          {hasPx ? formatPrice(priceNow) : '—'}
        </span>
        <span>
          <i>SIZE</i>
          {size}
        </span>
      </div>

      <div className="ometer" aria-hidden="true">
        <div className="track">
          <div className={`fill ${o.side === 'buy' ? 'b' : 's'}`} style={{ width: `${closeness * 100}%` }} />
          <span className="tick" />
        </div>
      </div>

      <div className="ofoot">
        <span className={`gap num ${ready ? 'up' : ''}`}>
          {gapPct == null
            ? 'waiting for a live price…'
            : ready
              ? '⚡ at trigger — filling'
              : `${dir === 'above' ? '▲ rise' : '▼ drop'} ${gapPct.toFixed(2)}% to fill`}
        </span>
        <span className="ots num">{placed}</span>
      </div>
    </div>
  )
}

/** The ORDERS tab: one animated card per resting order with a fill-proximity meter. */
export function OrderCards() {
  const mode = useSim((s) => s.mode)
  const list = useOrders((s) => s.orders[mode] ?? NO_ORDERS)
  const priceFor = usePriceFor()

  if (!list.length) {
    return (
      <div className="info">
        <div className="center-msg" style={{ height: 60 }}>
          No open orders — place a limit or stop from the ticket.
        </div>
      </div>
    )
  }
  return (
    <div className="ocards">
      {list.map((o) => (
        <OrderCard key={o.id} o={o} priceNow={priceFor(o.tokenKey)} />
      ))}
    </div>
  )
}
