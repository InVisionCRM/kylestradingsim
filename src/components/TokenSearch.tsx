import { useEffect, useRef, useState } from 'react'
import { searchPairs } from '../api/dexscreener'
import { useMarket } from '../state/useMarket'
import { useWatchlist } from '../state/useWatchlist'
import type { Pair } from '../types'
import { formatPriceUsd, formatCompactUsd } from '../lib/format'
import { TokenIcon } from './TokenIcon'
import { IconSearch } from './icons'

export function TokenSearch() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Pair[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = q.trim()
    if (!term) {
      setResults([])
      return
    }
    let alive = true
    const id = setTimeout(() => {
      searchPairs(term)
        .then((r) => alive && setResults(r.slice(0, 12)))
        .catch(() => alive && setResults([]))
    }, 280)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (p: Pair) => {
    useMarket.getState().setActivePair(p)
    useWatchlist
      .getState()
      .add({ chainId: p.chainId, pairAddress: p.pairAddress, symbol: p.baseToken.symbol, imageUrl: p.imageUrl })
    setQ('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="search" ref={boxRef}>
      <div className="field">
        <IconSearch />
        <input
          value={q}
          placeholder="Search token or paste address…"
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && q.trim() && (
        <div className="results">
          {results.length === 0 ? (
            <div className="empty">No matches — try a symbol like WIF or BONK.</div>
          ) : (
            results.map((p) => (
              <div className="res" key={`${p.chainId}:${p.pairAddress}`} onClick={() => pick(p)}>
                <TokenIcon src={p.imageUrl} symbol={p.baseToken.symbol} size={20} cls="ic" />
                <div>
                  <div className="s">{p.baseToken.symbol}</div>
                  <div className="ch">
                    {p.chainId} · {p.dexId}
                  </div>
                </div>
                <div className="meta">
                  <div className="num">{formatPriceUsd(p.priceUsd)}</div>
                  <div className="ch num">liq {formatCompactUsd(p.liquidityUsd)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
