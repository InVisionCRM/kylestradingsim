import { useEffect, useRef, useState } from 'react'
import { searchPairs } from '../api/dexscreener'
import { useMarket } from '../state/useMarket'
import { useWatchlist } from '../state/useWatchlist'
import { useUi } from '../state/useUi'
import type { Pair } from '../types'
import { formatPriceUsd, formatCompactUsd } from '../lib/format'
import { TokenIcon } from '../components/TokenIcon'
import { IconSearch } from '../components/icons'

/** Full-screen token search — replaces the desktop dropdown, which had no home on a phone. */
export function MobileSearch() {
  const open = useUi((s) => s.searchOpen)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Pair[]>([])
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setResults([])
      // focus after the overlay paints so the keyboard opens reliably
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    const term = q.trim()
    if (!term) {
      setResults([])
      setBusy(false)
      return
    }
    let alive = true
    setBusy(true)
    const id = setTimeout(() => {
      searchPairs(term)
        .then((r) => {
          if (!alive) return
          setResults(r.slice(0, 20))
          setBusy(false)
        })
        .catch(() => {
          if (!alive) return
          setResults([])
          setBusy(false)
        })
    }, 280)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [q])

  if (!open) return null

  const pick = (p: Pair) => {
    useMarket.getState().setActivePair(p)
    useWatchlist
      .getState()
      .add({ chainId: p.chainId, pairAddress: p.pairAddress, symbol: p.baseToken.symbol, imageUrl: p.imageUrl })
    useUi.getState().closeSearch()
    useUi.getState().setMobileTab('chart')
  }

  return (
    <div className="msearch">
      <div className="msearchhead">
        <div className="msearchfield">
          <IconSearch />
          <input
            ref={inputRef}
            type="search"
            value={q}
            placeholder="Search token or paste address…"
            autoComplete="off"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button className="mcancel" onClick={() => useUi.getState().closeSearch()}>
          Cancel
        </button>
      </div>
      <div className="msearchlist">
        {!q.trim() ? (
          <div className="center-msg" style={{ height: 120 }}>
            Search any token — WIF, BONK, or a pair address.
          </div>
        ) : busy && results.length === 0 ? (
          <div className="center-msg" style={{ height: 120 }}>
            Searching…
          </div>
        ) : results.length === 0 ? (
          <div className="center-msg" style={{ height: 120 }}>
            No matches — try a symbol like WIF or BONK.
          </div>
        ) : (
          results.map((p) => (
            <div className="row" key={`${p.chainId}:${p.pairAddress}`} onClick={() => pick(p)}>
              <TokenIcon src={p.imageUrl} symbol={p.baseToken.symbol} tokenKey={`${p.chainId}:${p.pairAddress}`} size={28} cls="ic" />
              <div className="rs">
                <div className="s">{p.baseToken.symbol}</div>
                <div className="n">
                  {p.chainId} · {p.dexId}
                </div>
              </div>
              <div className="meta">
                <div className="p num">{formatPriceUsd(p.priceUsd)}</div>
                <div className="c num muted">liq {formatCompactUsd(p.liquidityUsd)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
