import { TokenIcon } from './TokenIcon'
import { IconGlobe, IconXSocial, IconTelegram } from './icons'
import { formatAge } from '../lib/format'
import type { Pair } from '../types'
import type { DiscoveredPair } from '../api/pulsexDiscovery'
import type { JSX } from 'react'

const CHAIN_LABEL: Record<string, string> = {
  pulsechain: 'PulseChain',
  ethereum: 'Ethereum',
  solana: 'Solana',
  bsc: 'BSC',
  base: 'Base',
}

function socialIcon(type: string): JSX.Element | null {
  const t = type.toLowerCase()
  if (t.includes('twitter') || t === 'x') return <IconXSocial size={13} />
  if (t.includes('telegram')) return <IconTelegram size={13} />
  if (t.includes('web') || t.includes('site')) return <IconGlobe size={13} />
  return null
}

/**
 * DexScreener-style discovery tile: square card with the token logo
 * overhanging the top-center, name, blockchain, and social links.
 */
export function TokenTile({ pair, onPick }: { pair: Pair; onPick: (p: Pair) => void }) {
  // one icon per platform, max 3
  const socials: { url: string; icon: JSX.Element }[] = []
  const seen = new Set<string>()
  for (const s of pair.socials) {
    const icon = socialIcon(s.type)
    if (!icon) continue
    const kind = s.type.toLowerCase().includes('telegram') ? 'tg' : s.type.toLowerCase().includes('web') || s.type.toLowerCase().includes('site') ? 'web' : 'x'
    if (seen.has(kind)) continue
    seen.add(kind)
    socials.push({ url: s.url, icon })
    if (socials.length >= 3) break
  }

  return (
    <div className="ttile" role="button" tabIndex={0} onClick={() => onPick(pair)} onKeyDown={(e) => e.key === 'Enter' && onPick(pair)}>
      <TokenIcon src={pair.imageUrl} symbol={pair.baseToken.symbol} tokenKey={`${pair.chainId}:${pair.pairAddress}`} size={56} cls="tlogo" />
      <div className="tname">{pair.baseToken.name || pair.baseToken.symbol}</div>
      <div className="tchain">
        <span className={`cdot ${pair.chainId}`} />
        {CHAIN_LABEL[pair.chainId] ?? pair.chainId}
      </div>
      {socials.length > 0 ? (
        <div className="tsocials">
          {socials.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              {s.icon}
            </a>
          ))}
        </div>
      ) : (
        <div className="tsocials none">{pair.baseToken.symbol}</div>
      )}
    </div>
  )
}

/** Tile for a brand-new pool DexScreener hasn't indexed yet. */
export function RawTokenTile({ row, onPick }: { row: DiscoveredPair; onPick: (r: DiscoveredPair) => void }) {
  return (
    <div className="ttile" role="button" tabIndex={0} onClick={() => onPick(row)} onKeyDown={(e) => e.key === 'Enter' && onPick(row)}>
      <TokenIcon symbol={row.token0Sym} tokenKey={`pulsechain:${row.pairAddress}`} size={56} cls="tlogo" />
      <div className="tname">{row.token0Sym}</div>
      <div className="tchain">
        <span className="cdot pulsechain" />
        PulseChain
      </div>
      <div className="tsocials none">{row.createdAt != null ? `🌱 ${formatAge(row.createdAt * 1000)}` : `/${row.token1Sym}`}</div>
    </div>
  )
}