import { TokenIcon } from './TokenIcon'
import { formatPriceUsd, formatCompactUsd, formatPct, formatAge, shortAddr, signClass } from '../lib/format'
import type { Pair } from '../types'
import type { DiscoveredPair } from '../api/pulsexDiscovery'

/** DexScreener-style search result card: price + 24h, MCAP/LIQ/VOL/age grid, addresses. */
export function PairCard({ pair, onPick }: { pair: Pair; onPick: (p: Pair) => void }) {
  return (
    <button className="paircard" onClick={() => onPick(pair)}>
      <div className="pchead">
        <TokenIcon src={pair.imageUrl} symbol={pair.baseToken.symbol} tokenKey={`${pair.chainId}:${pair.pairAddress}`} size={34} cls="ic" />
        <div className="pcid">
          <div className="pcpair">
            <span className="dexb">{pair.dexId === 'pulsex' ? 'PULSEX' : pair.dexId.toUpperCase()}</span>
            <b>{pair.baseToken.symbol}</b>
            <span className="q">/ {pair.quoteToken.symbol || pair.chainId}</span>
            <span className="nm">{pair.baseToken.name}</span>
          </div>
          <div className="pcpx">
            {formatPriceUsd(pair.priceUsd)}
            <span className="lab"> 24H:</span>{' '}
            <span className={signClass(pair.priceChange24h)}>{formatPct(pair.priceChange24h)}</span>
          </div>
        </div>
      </div>
      <div className="pcgrid">
        <span>
          <i>MCAP:</i> {formatCompactUsd(pair.marketCap ?? pair.fdv)}
        </span>
        <span>
          <i>LIQ:</i> {formatCompactUsd(pair.liquidityUsd)}
        </span>
        <span>
          <i>VOL:</i> {formatCompactUsd(pair.volume24h)}
        </span>
        <span>
          <i>🌱</i> {formatAge(pair.pairCreatedAt)}
        </span>
      </div>
      <div className="pcaddr num">
        <span>
          PAIR: <b>{shortAddr(pair.pairAddress)}</b>
        </span>
        <span>
          TOKEN: <b>{shortAddr(pair.baseToken.address)}</b>
        </span>
      </div>
    </button>
  )
}

/** Slim row for pools DexScreener hasn't indexed yet (brand-new pairs). */
export function RawPairRow({ row, onPick }: { row: DiscoveredPair; onPick: (row: DiscoveredPair) => void }) {
  return (
    <button className="paircard slim" onClick={() => onPick(row)}>
      <div className="pchead">
        <TokenIcon symbol={row.token0Sym} tokenKey={`pulsechain:${row.pairAddress}`} size={26} cls="ic" />
        <div className="pcid">
          <div className="pcpair">
            <b>{row.token0Sym}</b>
            <span className="q">/ {row.token1Sym}</span>
            <span className="nm">not charted yet</span>
          </div>
        </div>
        <div className="pcside">
          <span>
            <i>LIQ:</i> {formatCompactUsd(row.reserveUsd)}
          </span>
          {row.createdAt != null && (
            <span>
              <i>🌱</i> {formatAge(row.createdAt * 1000)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}