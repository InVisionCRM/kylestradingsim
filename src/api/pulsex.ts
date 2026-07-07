/**
 * PulseX subgraphs (community Graph node on PulseChain) — power the live trade
 * tape. Keyless, CORS-open, browser-called directly. The node is community
 * infrastructure and individual subgraphs go slow or down, so each endpoint
 * gets an independent circuit breaker and a hard request timeout; the tape
 * simply shows whatever the healthy endpoints return.
 */

export interface TapeTrade {
  id: string
  ts: number
  side: 'buy' | 'sell'
  priceUsd: number
  qtyToken: number
  valueUsd: number
  wallet: string
  txHash: string
}

interface RawSwap {
  id: string
  timestamp: string
  amount0In: string
  amount1In: string
  amount0Out: string
  amount1Out: string
  amountUSD: string
  to: string
  pair: { token0: { id: string }; token1: { id: string } }
}

const TAPE_QUERY = `query($pair: String!) {
  swaps(first: 50, orderBy: timestamp, orderDirection: desc, where: { pair: $pair }) {
    id timestamp amount0In amount1In amount0Out amount1Out amountUSD to
    pair { token0 { id } token1 { id } }
  }
}`

const WALLET_QUERY = `query($w: Bytes!) {
  swaps(first: 1000, orderBy: timestamp, orderDirection: desc, where: { from: $w }) {
    id timestamp amount0In amount1In amount0Out amount1Out amountUSD to
    pair { token0 { id symbol } token1 { id symbol } }
  }
}`

const REQUEST_TIMEOUT_MS = 12000
const BREAKER_FAILS = 2 // consecutive failures before an endpoint is benched
const BREAKER_COOLDOWN_MS = 120000

interface Endpoint {
  url: string
  fails: number
  benchedUntil: number
}

const ENDPOINTS: Endpoint[] = [
  { url: 'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex', fails: 0, benchedUntil: 0 },
  { url: 'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsexv2', fails: 0, benchedUntil: 0 },
]

/** Maps a raw subgraph swap to a tape row, oriented around the pair's base token. Null = unusable row. */
export function swapToTape(s: RawSwap, baseTokenAddress: string): TapeTrade | null {
  const base = baseTokenAddress.toLowerCase()
  const isToken0 = s.pair.token0.id.toLowerCase() === base
  if (!isToken0 && s.pair.token1.id.toLowerCase() !== base) return null

  const baseIn = Number(isToken0 ? s.amount0In : s.amount1In) // base flowing INTO the pool = trader sold
  const baseOut = Number(isToken0 ? s.amount0Out : s.amount1Out) // base flowing OUT of the pool = trader bought
  const qty = Math.max(baseIn, baseOut)
  const valueUsd = Number(s.amountUSD)
  if (!(qty > 0) || !Number.isFinite(valueUsd)) return null

  return {
    id: s.id,
    ts: Number(s.timestamp),
    side: baseOut > baseIn ? 'buy' : 'sell',
    priceUsd: valueUsd > 0 ? valueUsd / qty : 0,
    qtyToken: qty,
    valueUsd,
    wallet: s.to,
    txHash: s.id.split('-')[0],
  }
}

async function querySwaps(ep: Endpoint, query: string, variables: Record<string, unknown>): Promise<RawSwap[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { data?: { swaps?: RawSwap[] }; errors?: unknown[] }
    if (!json.data?.swaps) throw new Error('subgraph error')
    ep.fails = 0
    return json.data.swaps
  } catch (e) {
    ep.fails++
    if (ep.fails >= BREAKER_FAILS) ep.benchedUntil = Date.now() + BREAKER_COOLDOWN_MS
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** Runs a swaps query against every healthy endpoint and merges the results. */
async function queryAll(query: string, variables: Record<string, unknown>): Promise<{ swaps: RawSwap[]; ok: boolean }> {
  const now = Date.now()
  const active = ENDPOINTS.filter((ep) => ep.benchedUntil <= now)
  if (!active.length) return { swaps: [], ok: false }

  const results = await Promise.allSettled(active.map((ep) => querySwaps(ep, query, variables)))
  const swaps: RawSwap[] = []
  let ok = false
  for (const r of results) {
    if (r.status === 'fulfilled') {
      ok = true
      swaps.push(...r.value)
    }
  }
  return { swaps, ok }
}

/**
 * Fetches recent swaps for a PulseX pool from every healthy subgraph (a pool
 * lives in exactly one of v1/v2, the other returns empty). `ok` is false only
 * when no endpoint could be queried at all.
 */
export async function fetchTape(
  pairAddress: string,
  baseTokenAddress: string,
): Promise<{ trades: TapeTrade[]; ok: boolean }> {
  const { swaps, ok } = await queryAll(TAPE_QUERY, { pair: pairAddress.toLowerCase() })
  const trades: TapeTrade[] = []
  for (const s of swaps) {
    const t = swapToTape(s, baseTokenAddress)
    if (t) trades.push(t)
  }
  return { trades, ok }
}

/** One PulseX swap originated by the wallet's transaction — its real buys and sells. */
export interface WalletSwap {
  ts: number
  amountUSD: number
  amount0In: number
  amount1In: number
  amount0Out: number
  amount1Out: number
  token0: { id: string; symbol: string }
  token1: { id: string; symbol: string }
}

/**
 * A wallet's actual swap history on PulseX (both subgraphs, newest 1000 per
 * version). Filtered by the swap `from` field — the TRANSACTION ORIGIN — so it
 * covers every leg of the wallet's trades, including sells whose output lands
 * on a router/aggregator first and multi-hop routes.
 */
export async function fetchWalletSwaps(wallet: string): Promise<{ swaps: WalletSwap[]; ok: boolean }> {
  const { swaps, ok } = await queryAll(WALLET_QUERY, { w: wallet.toLowerCase() })
  const out: WalletSwap[] = []
  const seen = new Set<string>()
  for (const s of swaps) {
    if (seen.has(s.id)) continue // defensive: never double-count a swap across endpoints
    seen.add(s.id)
    const p = s.pair as { token0: { id: string; symbol?: string }; token1: { id: string; symbol?: string } }
    out.push({
      ts: Number(s.timestamp),
      amountUSD: Number(s.amountUSD),
      amount0In: Number(s.amount0In),
      amount1In: Number(s.amount1In),
      amount0Out: Number(s.amount0Out),
      amount1Out: Number(s.amount1Out),
      token0: { id: p.token0.id.toLowerCase(), symbol: p.token0.symbol ?? '?' },
      token1: { id: p.token1.id.toLowerCase(), symbol: p.token1.symbol ?? '?' },
    })
  }
  out.sort((a, b) => a.ts - b.ts)
  return { swaps: out, ok }
}
