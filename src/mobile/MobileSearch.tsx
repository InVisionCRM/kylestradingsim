import { useEffect, useRef, useState } from 'react'
import { searchPairs, getPair } from '../api/dexscreener'
import { ensureLogo } from '../lib/logos'
import { fetchTopPulsePairs, fetchNewPulsePairs, type DiscoveredPair } from '../api/pulsexDiscovery'
import { useMarket } from '../state/useMarket'
import { useWatchlist } from '../state/useWatchlist'
import { useRecents } from '../state/useRecents'
import { useUi } from '../state/useUi'
import type { Pair } from '../types'
import { PairCard, RawPairRow } from '../components/PairCard'
import { TokenIcon } from '../components/TokenIcon'
import { IconSearch } from '../components/icons'

/** PulseChain pairs first — that's the app's home turf. */
function pulseFirst(pairs: Pair[]): Pair[] {
  return [...pairs.filter((p) => p.chainId === 'pulsechain'), ...pairs.filter((p) => p.chainId !== 'pulsechain')]
}

function DiscoverList({ rows, onPick, onPickRaw }: { rows: DiscoveredPair[] | null; onPick: (p: Pair) => void; onPickRaw: (r: DiscoveredPair) => void }) {
  if (rows === null) {
    return (
      <div className="tapeload">
        {[0, 1, 2].map((i) => (
          <div className="skeleton" key={i} style={{ height: 92 }} />
        ))}
      </div>
    )
  }
  if (rows.length === 0) {
    return <div className="center-msg" style={{ height: 60 }}>PulseX data unavailable right now.</div>
  }
  return (
    <>
      {rows.map((r) =>
        r.pair ? <PairCard key={r.pairAddress} pair={r.pair} onPick={onPick} /> : <RawPairRow key={r.pairAddress} row={r} onPick={onPickRaw} />,
      )}
    </>
  )
}

/** Full-screen token search: recents, Top on PulseChain, new PulseX pairs, card results. */
export function MobileSearch() {
  const open = useUi((s) => s.searchOpen)
  const recents = useRecents((s) => s.items)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Pair[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [top, setTop] = useState<DiscoveredPair[] | null>(null)
  const [fresh, setFresh] = useState<DiscoveredPair[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQ('')
    setResults([])
    setNote(null)
    requestAnimationFrame(() => inputRef.current?.focus())
    fetchTopPulsePairs()
      .then(setTop)
      .catch(() => setTop([]))
    fetchNewPulsePairs()
      .then(setFresh)
      .catch(() => setFresh([]))
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
          const list = pulseFirst(r).slice(0, 20)
          list.slice(0, 10).forEach(ensureLogo)
          setResults(list)
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
    useRecents
      .getState()
      .add({ chainId: p.chainId, pairAddress: p.pairAddress, symbol: p.baseToken.symbol, imageUrl: p.imageUrl })
    useUi.getState().closeSearch()
    useUi.getState().setMobileTab('chart')
  }
  const pickRecent = async (chainId: string, pairAddress: string) => {
    setNote(null)
    const p = await getPair(chainId, pairAddress).catch(() => null)
    if (p) pick(p)
    else setNote("Couldn't load that token right now.")
  }
  const pickRaw = async (row: DiscoveredPair) => {
    setNote(null)
    const p = row.pair ?? (await getPair('pulsechain', row.pairAddress).catch(() => null))
    if (p) pick(p)
    else setNote(`${row.token0Sym}/${row.token1Sym} isn't charted yet — try again in a few minutes.`)
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
        {note && <div className="wnote err">{note}</div>}

        {q.trim() ? (
          busy && results.length === 0 ? (
            <div className="center-msg" style={{ height: 120 }}>
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="center-msg" style={{ height: 120 }}>
              No matches — try a symbol like HEX or PLSX.
            </div>
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
              <DiscoverList rows={top} onPick={pick} onPickRaw={pickRaw} />
            </div>

            <div className="shint">NEW PAIRS ON PULSEX</div>
            <div className="pclist">
              <DiscoverList rows={fresh} onPick={pick} onPickRaw={pickRaw} />
            </div>
            <div style={{ height: 16 }} />
          </>
        )}
      </div>
    </div>
  )
}