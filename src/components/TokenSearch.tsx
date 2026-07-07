import { useEffect, useRef, useState } from 'react'
import { searchPairs, getPair } from '../api/dexscreener'
import { fetchTopPulsePairs, type DiscoveredPair } from '../api/pulsexDiscovery'
import { useMarket } from '../state/useMarket'
import { useWatchlist } from '../state/useWatchlist'
import { useRecents } from '../state/useRecents'
import type { Pair } from '../types'
import { PairCard } from './PairCard'
import { TokenIcon } from './TokenIcon'
import { IconSearch } from './icons'

function pulseFirst(pairs: Pair[]): Pair[] {
  return [...pairs.filter((p) => p.chainId === 'pulsechain'), ...pairs.filter((p) => p.chainId !== 'pulsechain')]
}

/** Desktop search: DexScreener-style cards, with recents + top PulseChain pairs on focus. */
export function TokenSearch() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Pair[]>([])
  const [open, setOpen] = useState(false)
  const [top, setTop] = useState<DiscoveredPair[] | null>(null)
  const recents = useRecents((s) => s.items)
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
        .then((r) => alive && setResults(pulseFirst(r).slice(0, 12)))
        .catch(() => alive && setResults([]))
    }, 280)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [q])

  useEffect(() => {
    if (!open || top !== null) return
    fetchTopPulsePairs()
      .then(setTop)
      .catch(() => setTop([]))
  }, [open, top])

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [])

  const pick = (p: Pair) => {
    useMarket.getState().setActivePair(p)
    useWatchlist
      .getState()
      .add({ chainId: p.chainId, pairAddress: p.pairAddress, symbol: p.baseToken.symbol, imageUrl: p.imageUrl })
    useRecents
      .getState()
      .add({ chainId: p.chainId, pairAddress: p.pairAddress, symbol: p.baseToken.symbol, imageUrl: p.imageUrl })
    setQ('')
    setResults([])
    setOpen(false)
  }
  const pickRecent = async (chainId: string, pairAddress: string) => {
    const p = await getPair(chainId, pairAddress).catch(() => null)
    if (p) pick(p)
  }

  const showBrowse = open && !q.trim()

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
      {open && (q.trim() || showBrowse) && (
        <div className="results">
          {q.trim() ? (
            results.length === 0 ? (
              <div className="empty">No matches — try a symbol like HEX or PLSX.</div>
            ) : (
              <div className="pclist">
                {results.map((p) => (
                  <PairCard key={`${p.chainId}:${p.pairAddress}`} pair={p} onPick={pick} />
                ))}
              </div>
            )
          ) : (
            <>
              {recents.length > 0 && (
                <div className="rchips">
                  <span className="clock">🕐</span>
                  {recents.map((r) => (
                    <button className="rchip" key={`${r.chainId}:${r.pairAddress}`} onClick={() => pickRecent(r.chainId, r.pairAddress)}>
                      <TokenIcon symbol={r.symbol} src={r.imageUrl} tokenKey={`${r.chainId}:${r.pairAddress}`} size={18} cls="ic" />
                      {r.symbol}
                    </button>
                  ))}
                  <button className="rclear" title="Clear recent searches" onClick={() => useRecents.getState().clear()}>
                    ⌫
                  </button>
                </div>
              )}
              <div className="shint">TOP ON PULSECHAIN · 24H VOLUME</div>
              <div className="pclist">
                {top === null ? (
                  <div className="empty">Loading PulseX movers…</div>
                ) : top.length === 0 ? (
                  <div className="empty">PulseX data unavailable right now.</div>
                ) : (
                  top.filter((r) => r.pair).map((r) => <PairCard key={r.pairAddress} pair={r.pair!} onPick={pick} />)
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}