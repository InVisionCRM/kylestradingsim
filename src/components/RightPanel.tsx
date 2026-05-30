import { useState } from 'react'
import { useMarket } from '../state/useMarket'
import { useSim } from '../state/useSim'
import { useCurrentPrice, useActiveTokenKey, usePriceFor } from '../hooks/useDerived'
import { getPair } from '../api/dexscreener'
import { useOrders } from '../state/useOrders'
import { orderLabel } from '../sim/orders'
import { OrderPanel } from './OrderPanel'
import { TokenIcon } from './TokenIcon'
import { IconLink } from './icons'

async function goToToken(chainId: string, pairAddress: string) {
  const p = await getPair(chainId, pairAddress).catch(() => null)
  if (p) useMarket.getState().setActivePair(p)
}
import { unrealizedPnl, positionValue } from '../sim/engine'
import { formatUsd, formatPrice, formatQty, formatPct, formatCompactUsd, signClass } from '../lib/format'

function InfoGrid() {
  const pair = useMarket((s) => s.activePair)
  if (!pair) return <div className="info" />
  return (
    <div className="info">
      <div className="stat">
        <div className="k">LIQUIDITY</div>
        <div className="v">{formatCompactUsd(pair.liquidityUsd)}</div>
      </div>
      <div className="stat">
        <div className="k">24H VOLUME</div>
        <div className="v">{formatCompactUsd(pair.volume24h)}</div>
      </div>
      <div className="stat">
        <div className="k">MARKET CAP</div>
        <div className="v">{formatCompactUsd(pair.marketCap)}</div>
      </div>
      <div className="stat">
        <div className="k">FDV</div>
        <div className="v">{formatCompactUsd(pair.fdv)}</div>
      </div>
      {pair.socials.length > 0 && (
        <div className="socials">
          {pair.socials.slice(0, 4).map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" title={s.type}>
              <IconLink />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function PositionsMini() {
  const account = useSim((s) => s.accounts[s.mode])
  const priceFor = usePriceFor()
  const list = Object.values(account.positions)
  if (list.length === 0) return <div className="info"><div className="center-msg" style={{ height: 60 }}>No open positions.</div></div>
  return (
    <div className="minilist">
      {list.map((p) => {
        const px = priceFor(p.tokenKey) ?? p.avgEntryUsd
        const up = (px - p.avgEntryUsd) * p.qty
        return (
          <div className="row" key={p.tokenKey} onClick={() => goToToken(p.chainId, p.pairAddress)}>
            <TokenIcon symbol={p.symbol} src={p.imageUrl} tokenKey={p.tokenKey} size={20} />
            <span className="s">{p.symbol}</span>
            <div className="meta">
              <div className="p num">{formatQty(p.qty)}</div>
              <div className={`c num ${signClass(up)}`}>{formatUsd(up)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OrdersList() {
  const mode = useSim((s) => s.mode)
  const list = useOrders((s) => s.orders[mode] ?? [])
  if (!list.length) return <div className="info"><div className="center-msg" style={{ height: 60 }}>No open orders.</div></div>
  return (
    <div className="minilist">
      {list.map((o) => (
        <div className="orow" key={o.id}>
          <span className={`okind ${o.kind}`}>{orderLabel(o)}</span>
          <span className="osym">{o.symbol}</span>
          <span className="oprice num">@ {formatPrice(o.price)}</span>
          <span className="osize num">{o.sizeUsd != null ? formatUsd(o.sizeUsd) : o.sizeToken != null ? formatQty(o.sizeToken) : 'close'}</span>
          <button className="ocancel" title="Cancel order" onClick={() => useOrders.getState().cancel(mode, o.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export function RightPanel() {
  const pair = useMarket((s) => s.activePair)
  const mode = useSim((s) => s.mode)
  const account = useSim((s) => s.accounts[s.mode])
  const orderCount = useOrders((s) => (s.orders[mode] ?? []).length)
  const price = useCurrentPrice()
  const activeKey = useActiveTokenKey()
  const [tab, setTab] = useState<'info' | 'positions' | 'orders'>('info')

  const pos = activeKey ? account.positions[activeKey] : undefined
  const sym = pair?.baseToken.symbol ?? ''
  const upnl = pos && price ? unrealizedPnl(pos, price) : 0
  const upnlPct = pos && price && pos.avgEntryUsd ? (price / pos.avgEntryUsd - 1) * 100 : 0
  const mv = pos && price ? positionValue(pos, price) : 0

  return (
    <div className="col scroll">
      <OrderPanel />

      <div className="pos">
        <div className="sechead" style={{ padding: '0 0 8px' }}>
          YOUR POSITION{sym && ` · ${sym}`}
        </div>
        {pos ? (
          <>
            <div className="posrow">
              <span className="k">Holdings</span>
              <span className="v num">
                {formatQty(pos.qty)} {sym}
              </span>
            </div>
            <div className="posrow">
              <span className="k">Avg entry</span>
              <span className="v num">{formatPrice(pos.avgEntryUsd)}</span>
            </div>
            <div className="posrow">
              <span className="k">Market value</span>
              <span className="v num">{formatUsd(mv)}</span>
            </div>
            <div className="posrow">
              <span className="k">Unrealized P&amp;L</span>
              <span className={`v num ${signClass(upnl)}`}>
                {formatUsd(upnl)} ({formatPct(upnlPct)})
              </span>
            </div>
          </>
        ) : (
          <div className="empty">No position in {sym || 'this token'} yet.</div>
        )}
      </div>

      <div className="tabs">
        <button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')}>
          INFO
        </button>
        <button className={tab === 'positions' ? 'on' : ''} onClick={() => setTab('positions')}>
          POSITIONS
        </button>
        <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>
          ORDERS{orderCount ? ` (${orderCount})` : ''}
        </button>
      </div>
      {tab === 'info' ? <InfoGrid /> : tab === 'positions' ? <PositionsMini /> : <OrdersList />}
    </div>
  )
}
