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

const QUERY = `query($pair: String!) {
  swaps(first: 50, orderBy: timestamp, orderDirection: desc, where: { pair: $pair }) {
    id timestamp amount0In amount1In amount0Out amount1Out amountUSD to
    pair { token0 { id } token1 { id } }
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

async function queryEndpoint(ep: Endpoint, pairAddress: string, baseTokenAddress: string): Promise<TapeTrade[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { pair: pairAddress.toLowerCase() } }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { data?: { swaps?: RawSwap[] }; errors?: unknown[] }
    if (!json.data?.swaps) throw new Error('subgraph error')
    ep.fails = 0
    const out: TapeTrade[] = []
    for (const s of json.data.swaps) {
      const t = swapToTape(s, baseTokenAddress)
      if (t) out.push(t)
    }
    return out
  } catch (e) {
    ep.fails++
    if (ep.fails >= BREAKER_FAILS) ep.benchedUntil = Date.now() + BREAKER_COOLDOWN_MS
    throw e
  } finally {
    clearTimeout(timer)
  }
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
  const now = Date.now()
  const active = ENDPOINTS.filter((ep) => ep.benchedUntil <= now)
  if (!active.length) return { trades: [], ok: false }

  const results = await Promise.allSettled(active.map((ep) => queryEndpoint(ep, pairAddress, baseTokenAddress)))
  const trades: TapeTrade[] = []
  let ok = false
  for (const r of results) {
    if (r.status === 'fulfilled') {
      ok = true
      trades.push(...r.value)
    }
  }
  return { trades, ok }
}
