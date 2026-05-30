import { dsGet } from './client'
import type { Pair } from '../types'

interface RawPair {
  chainId: string
  dexId: string
  pairAddress: string
  url?: string
  baseToken?: { address?: string; name?: string; symbol?: string }
  quoteToken?: { address?: string; name?: string; symbol?: string }
  priceUsd?: string | number
  priceNative?: string | number
  liquidity?: { usd?: number }
  fdv?: number
  marketCap?: number
  volume?: Record<string, number>
  priceChange?: Record<string, number>
  pairCreatedAt?: number
  info?: {
    imageUrl?: string
    websites?: { url: string }[]
    socials?: { type?: string; platform?: string; url?: string; handle?: string }[]
  }
}

const toNum = (v: unknown): number | null => {
  if (v == null) return null
  const n = Number(v)
  return isFinite(n) ? n : null
}

export function normalizePair(p: RawPair): Pair {
  const socials = [
    ...(p.info?.websites ?? []).map((w) => ({ type: 'web', url: w.url })),
    ...(p.info?.socials ?? []).map((s) => ({
      type: s.type ?? s.platform ?? 'link',
      url: s.url ?? '',
    })),
  ].filter((s) => !!s.url)

  return {
    chainId: p.chainId,
    dexId: p.dexId,
    pairAddress: p.pairAddress,
    url: p.url ?? null,
    baseToken: {
      address: p.baseToken?.address ?? '',
      name: p.baseToken?.name ?? '',
      symbol: p.baseToken?.symbol ?? '?',
    },
    quoteToken: {
      address: p.quoteToken?.address ?? '',
      name: p.quoteToken?.name ?? '',
      symbol: p.quoteToken?.symbol ?? '',
    },
    priceUsd: toNum(p.priceUsd),
    priceNative: toNum(p.priceNative),
    liquidityUsd: toNum(p.liquidity?.usd),
    fdv: toNum(p.fdv),
    marketCap: toNum(p.marketCap),
    volume24h: toNum(p.volume?.h24),
    priceChange24h: toNum(p.priceChange?.h24),
    imageUrl: p.info?.imageUrl ?? null,
    socials,
    pairCreatedAt: p.pairCreatedAt ?? null,
  }
}

const byLiquidity = (a: Pair, b: Pair) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0)

/** Free-text token search. Returns pairs ranked by liquidity. */
export async function searchPairs(q: string): Promise<Pair[]> {
  if (!q.trim()) return []
  const data = await dsGet<{ pairs?: RawPair[] }>(`/latest/dex/search?q=${encodeURIComponent(q)}`)
  return (data.pairs ?? []).map(normalizePair).sort(byLiquidity)
}

/** Refresh a single pair (used for live price polling + active token detail). */
export async function getPair(chainId: string, pairAddress: string): Promise<Pair | null> {
  const data = await dsGet<{ pairs?: RawPair[] }>(`/latest/dex/pairs/${chainId}/${pairAddress}`)
  const p = (data.pairs ?? [])[0]
  return p ? normalizePair(p) : null
}

/** Highest-liquidity pool for a token address. */
export async function getTokenTopPair(chainId: string, tokenAddress: string): Promise<Pair | null> {
  const data = await dsGet<RawPair[]>(`/tokens/v1/${chainId}/${tokenAddress}`)
  const pairs = (Array.isArray(data) ? data : []).map(normalizePair).sort(byLiquidity)
  return pairs[0] ?? null
}

interface BoostEntry {
  chainId: string
  tokenAddress: string
}

/** Best-effort "trending" list from DexScreener boosts (enriched to top pools). */
export async function getTrending(limit = 6): Promise<Pair[]> {
  const boosts = await dsGet<BoostEntry[]>(`/token-boosts/top/v1`)
  const top = (Array.isArray(boosts) ? boosts : []).slice(0, limit)
  const pairs = await Promise.all(top.map((b) => getTokenTopPair(b.chainId, b.tokenAddress).catch(() => null)))
  return pairs.filter((p): p is Pair => p != null)
}
