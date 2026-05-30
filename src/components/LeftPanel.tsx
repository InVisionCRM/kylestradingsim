import { useEffect, useState } from 'react'
import { useWatchlist } from '../state/useWatchlist'
import { useMarket } from '../state/useMarket'
import { getPair } from '../api/dexscreener'
import { ensureLogo } from '../lib/logos'
import { usePrices } from '../state/usePrices'
import type { Pair, WatchItem } from '../types'
import { formatPrice, formatPct, signClass } from '../lib/format'
import { TokenIcon } from './TokenIcon'
import { WalletImport } from './WalletImport'

function useWatchPrices(items: WatchItem[]): Record<string, Pair> {
  const [map, setMap] = useState<Record<string, Pair>>({})
  const dep = items.map((i) => `${i.chainId}:${i.pairAddress}`).join(',')
  useEffect(() => {
    let alive = true
    const load = async () => {
      for (const it of items) {
        try {
          const p = await getPair(it.chainId, it.pairAddress)
          if (alive && p) {
            ensureLogo(p)
            if (p.priceUsd) usePrices.getState().setPrice(`${it.chainId}:${it.pairAddress}`, p.priceUsd, p.liquidityUsd)
            setMap((m) => ({ ...m, [`${it.chainId}:${it.pairAddress}`]: p }))
          }
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

export function LeftPanel() {
  const items = useWatchlist((s) => s.items)
  const remove = useWatchlist((s) => s.remove)
  const prices = useWatchPrices(items)
  const activeKey = useMarket((s) => (s.activePair ? `${s.activePair.chainId}:${s.activePair.pairAddress}` : ''))

  const select = async (chainId: string, pairAddress: string, known?: Pair) => {
    const p = known ?? (await getPair(chainId, pairAddress).catch(() => null))
    if (p) useMarket.getState().setActivePair(p)
  }

  return (
    <div className="col scroll">
      <WalletImport />
      <div className="sechead">WATCHLIST</div>
      {items.length === 0 && <div className="center-msg" style={{ height: 80 }}>Loading markets…</div>}
      {items.map((it) => {
        const key = `${it.chainId}:${it.pairAddress}`
        const pair = prices[key]
        return (
          <div className={`row ${activeKey === key ? 'sel' : ''}`} key={key} onClick={() => select(it.chainId, it.pairAddress, pair)}>
            <TokenIcon symbol={it.symbol} src={pair?.imageUrl ?? it.imageUrl} tokenKey={key} size={20} />
            <span className="s">{it.symbol}</span>
            <div className="meta">
              <div className="p num">{pair ? formatPrice(pair.priceUsd) : '—'}</div>
              <div className={`c num ${signClass(pair?.priceChange24h ?? null)}`}>{pair ? formatPct(pair.priceChange24h) : ' '}</div>
            </div>
            <button
              className="rm"
              title="Remove"
              onClick={(e) => {
                e.stopPropagation()
                remove(it.chainId, it.pairAddress)
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
