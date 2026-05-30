import { useEffect, useState } from 'react'
import { useWatchlist } from '../state/useWatchlist'
import { useMarket } from '../state/useMarket'
import { getPair, getTrending } from '../api/dexscreener'
import type { Pair, WatchItem } from '../types'
import { formatPrice, formatPct, signClass } from '../lib/format'
import { TokenIcon } from './TokenIcon'

function useWatchPrices(items: WatchItem[]): Record<string, Pair> {
  const [map, setMap] = useState<Record<string, Pair>>({})
  const dep = items.map((i) => `${i.chainId}:${i.pairAddress}`).join(',')
  useEffect(() => {
    let alive = true
    const load = async () => {
      for (const it of items) {
        try {
          const p = await getPair(it.chainId, it.pairAddress)
          if (alive && p) setMap((m) => ({ ...m, [`${it.chainId}:${it.pairAddress}`]: p }))
        } catch {
          /* ignore transient */
        }
      }
    }
    load()
    const id = setInterval(load, 30000)
    return () => {
      alive = false
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])
  return map
}

function MarketRow({
  symbol,
  pair,
  fallbackLogo,
  active,
  onSelect,
  onRemove,
}: {
  symbol: string
  pair: Pair | undefined
  fallbackLogo: string | null
  active: boolean
  onSelect: () => void
  onRemove?: () => void
}) {
  return (
    <div className={`row ${active ? 'sel' : ''}`} onClick={onSelect}>
      <TokenIcon src={pair?.imageUrl ?? fallbackLogo} symbol={symbol} size={20} />
      <span className="s">{symbol}</span>
      <div className="meta">
        <div className="p num">{pair ? formatPrice(pair.priceUsd) : '—'}</div>
        <div className={`c num ${signClass(pair?.priceChange24h ?? null)}`}>
          {pair ? formatPct(pair.priceChange24h) : ' '}
        </div>
      </div>
      {onRemove && (
        <button
          className="rm"
          title="Remove"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

export function LeftPanel() {
  const items = useWatchlist((s) => s.items)
  const remove = useWatchlist((s) => s.remove)
  const prices = useWatchPrices(items)
  const activeKey = useMarket((s) => (s.activePair ? `${s.activePair.chainId}:${s.activePair.pairAddress}` : ''))
  const [trending, setTrending] = useState<Pair[]>([])

  useEffect(() => {
    let alive = true
    getTrending(6)
      .then((t) => alive && setTrending(t))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const select = async (chainId: string, pairAddress: string, known?: Pair) => {
    const p = known ?? (await getPair(chainId, pairAddress).catch(() => null))
    if (p) useMarket.getState().setActivePair(p)
  }

  return (
    <div className="col scroll">
      <div className="sechead">WATCHLIST</div>
      {items.length === 0 && <div className="center-msg" style={{ height: 80 }}>Loading markets…</div>}
      {items.map((it) => {
        const key = `${it.chainId}:${it.pairAddress}`
        return (
          <MarketRow
            key={key}
            symbol={it.symbol}
            pair={prices[key]}
            fallbackLogo={it.imageUrl}
            active={activeKey === key}
            onSelect={() => select(it.chainId, it.pairAddress, prices[key])}
            onRemove={() => remove(it.chainId, it.pairAddress)}
          />
        )
      })}

      {trending.length > 0 && (
        <>
          <div className="sechead" style={{ marginTop: 6 }}>
            TRENDING <span className="boost">DEXSCREENER</span>
          </div>
          {trending.map((p) => {
            const key = `${p.chainId}:${p.pairAddress}`
            return (
              <MarketRow
                key={'t' + key}
                symbol={p.baseToken.symbol}
                pair={p}
                fallbackLogo={p.imageUrl}
                active={activeKey === key}
                onSelect={() => select(p.chainId, p.pairAddress, p)}
              />
            )
          })}
        </>
      )}
    </div>
  )
}
