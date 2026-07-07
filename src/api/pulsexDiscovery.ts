import { subgraphQueryAll } from './pulsex'
import { getPair } from './dexscreener'
import { ensureLogo } from '../lib/logos'
import type { Pair } from '../types'

/**
 * PulseChain discovery feeds for the search screen — top pairs by today's
 * volume and freshly created pools, straight from the PulseX subgraphs.
 * Rows are hydrated into full DexScreener `Pair`s (price, mcap, 24h change)
 * where DexScreener knows the pool; brand-new pools may not be indexed yet
 * and stay as raw rows.
 */
export interface DiscoveredPair {
  pairAddress: string
  token0Sym: string
  token1Sym: string
  reserveUsd: number
  volumeUsd: number | null
  createdAt: number | null // unix seconds
  /** full DexScreener pair when hydration succeeded */
  pair: Pair | null
}

// date_gte over the last TWO UTC days — right after UTC midnight "today" has no
// pairDayData entities yet, which made this section read empty in production.
const TOP_QUERY = `query($d: Int!) {
  pairDayDatas(first: 32, orderBy: dailyVolumeUSD, orderDirection: desc, where: { date_gte: $d }) {
    pairAddress dailyVolumeUSD reserveUSD token0 { symbol } token1 { symbol }
  }
}`

const NEW_QUERY = `query($t: BigInt!) {
  pairs(first: 16, orderBy: timestamp, orderDirection: desc, where: { timestamp_gt: $t }) {
    id timestamp reserveUSD token0 { symbol } token1 { symbol }
  }
}`

interface RawDay {
  pairAddress: string
  dailyVolumeUSD: string
  reserveUSD: string
  token0: { symbol: string }
  token1: { symbol: string }
}
interface RawNew {
  id: string
  timestamp: string
  reserveUSD: string
  token0: { symbol: string }
  token1: { symbol: string }
}

const HYDRATE_LIMIT = 8
const CACHE_MS = 3 * 60 * 1000
const cache = new Map<string, { at: number; rows: DiscoveredPair[] }>()

async function hydrate(rows: DiscoveredPair[]): Promise<void> {
  await Promise.all(
    rows.slice(0, HYDRATE_LIMIT).map(async (r) => {
      try {
        r.pair = await getPair('pulsechain', r.pairAddress)
        if (r.pair) ensureLogo(r.pair) // real token logos (GeckoTerminal fallback)
      } catch {
        r.pair = null
      }
    }),
  )
}

/** Top PulseX pairs by today's volume. Cached ~3 min. */
export async function fetchTopPulsePairs(): Promise<DiscoveredPair[]> {
  const hit = cache.get('top')
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows
  const dayStart = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400
  const { items } = await subgraphQueryAll<RawDay>(
    TOP_QUERY,
    { d: dayStart },
    (d) => (d as { pairDayDatas?: RawDay[] }).pairDayDatas ?? [],
  )
  const seen = new Set<string>()
  const rows: DiscoveredPair[] = []
  for (const it of items.sort((a, b) => Number(b.dailyVolumeUSD) - Number(a.dailyVolumeUSD))) {
    const addr = it.pairAddress.toLowerCase()
    if (seen.has(addr)) continue
    seen.add(addr)
    rows.push({
      pairAddress: addr,
      token0Sym: it.token0.symbol,
      token1Sym: it.token1.symbol,
      reserveUsd: Number(it.reserveUSD),
      volumeUsd: Number(it.dailyVolumeUSD),
      createdAt: null,
      pair: null,
    })
    if (rows.length >= HYDRATE_LIMIT) break
  }
  await hydrate(rows)
  if (rows.length > 0) cache.set('top', { at: Date.now(), rows }) // never cache a failure
  return rows
}

/** Pools created on PulseX in the last 14 days, newest first. Cached ~3 min. */
export async function fetchNewPulsePairs(): Promise<DiscoveredPair[]> {
  const hit = cache.get('new')
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows
  const since = Math.floor(Date.now() / 1000) - 14 * 86400
  const { items } = await subgraphQueryAll<RawNew>(
    NEW_QUERY,
    { t: String(since) },
    (d) => (d as { pairs?: RawNew[] }).pairs ?? [],
  )
  const seen = new Set<string>()
  const rows: DiscoveredPair[] = []
  for (const it of items.sort((a, b) => Number(b.timestamp) - Number(a.timestamp))) {
    const addr = it.id.toLowerCase()
    if (seen.has(addr) || !(Number(it.reserveUSD) > 25)) continue // skip empty/dust pools
    seen.add(addr)
    rows.push({
      pairAddress: addr,
      token0Sym: it.token0.symbol,
      token1Sym: it.token1.symbol,
      reserveUsd: Number(it.reserveUSD),
      volumeUsd: null,
      createdAt: Number(it.timestamp),
      pair: null,
    })
    if (rows.length >= HYDRATE_LIMIT) break
  }
  await hydrate(rows)
  if (rows.length > 0) cache.set('new', { at: Date.now(), rows }) // never cache a failure
  return rows
}