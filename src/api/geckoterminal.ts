import { gtGet } from './client'
import { toGeckoNetwork } from './chains'
import type { Candle, Timeframe } from '../types'

const TF: Record<Timeframe, { path: 'minute' | 'hour' | 'day'; aggregate: number; seconds: number }> = {
  '1m': { path: 'minute', aggregate: 1, seconds: 60 },
  '5m': { path: 'minute', aggregate: 5, seconds: 300 },
  '15m': { path: 'minute', aggregate: 15, seconds: 900 },
  '1h': { path: 'hour', aggregate: 1, seconds: 3600 },
  '4h': { path: 'hour', aggregate: 4, seconds: 14400 },
  '1d': { path: 'day', aggregate: 1, seconds: 86400 },
}

export function timeframeSeconds(tf: Timeframe): number {
  return TF[tf].seconds
}

interface OhlcvResponse {
  data?: { attributes?: { ohlcv_list?: (number | string)[][] } }
}

const cache = new Map<string, { at: number; data: Candle[] }>()

// GeckoTerminal returns at most 1000 bars per call. Page backwards this many times
// (stopping early when history runs out) so the chart shows deep history without
// hammering the rate-limited API.
const MAX_OHLCV_PAGES = 5

/**
 * Historical OHLCV candles from GeckoTerminal, delivered PROGRESSIVELY:
 * `onPage` fires after every page with the full ascending series so far, so the
 * chart renders after ~1 request (~1000 bars) while deeper history streams in
 * behind it. Aborting the signal stops paging immediately and drops any queued
 * requests, so rapid timeframe switching never clogs the rate-limit queue.
 */
export async function fetchOhlcvPaged(
  chainId: string,
  poolAddress: string,
  tf: Timeframe,
  onPage: (candles: Candle[], done: boolean) => void,
  signal?: AbortSignal,
): Promise<void> {
  const network = toGeckoNetwork(chainId)
  if (!network) throw new Error(`Charts aren't supported for chain "${chainId}" yet`)

  const conf = TF[tf]
  const key = `${network}/${poolAddress}/${tf}`
  const ttl = Math.min(conf.seconds, 60) * 1000
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttl) {
    onPage(hit.data, true)
    return
  }

  // One call = up to 1000 bars; page backwards with before_timestamp for deep history.
  const base = `/networks/${network}/pools/${poolAddress}/ohlcv/${conf.path}?aggregate=${conf.aggregate}&limit=1000&currency=usd&token=base`
  const byTime = new Map<number, Candle>()
  let before: number | null = null
  let oldest = Infinity
  let out: Candle[] = []

  for (let page = 0; page < MAX_OHLCV_PAGES; page++) {
    const path = before == null ? base : `${base}&before_timestamp=${before}`
    const json = await gtGet<OhlcvResponse>(path, signal)
    const list = json?.data?.attributes?.ohlcv_list ?? []

    let pageOldest = Infinity
    for (const r of list) {
      const time = Number(r[0])
      const close = Number(r[4])
      if (!isFinite(time) || !isFinite(close) || close <= 0) continue
      if (!byTime.has(time)) {
        byTime.set(time, { time, open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close, volume: Number(r[5]) })
      }
      if (time < pageOldest) pageOldest = time
    }

    // ascending, unique times (chart requirement)
    out = [...byTime.values()].sort((a, b) => a.time - b.time)
    // a short page means we've hit the start of available history; no progress also stops us
    const done =
      page === MAX_OHLCV_PAGES - 1 || list.length < 1000 || !isFinite(pageOldest) || pageOldest >= oldest
    if (signal?.aborted) return
    onPage(out, done)
    if (done) break
    oldest = pageOldest
    before = pageOldest
  }

  cache.set(key, { at: Date.now(), data: out })
}

interface TokenInfoResponse {
  data?: { attributes?: { image_url?: string | null } }
}

const imageCache = new Map<string, string | null>()

/** Token logo from GeckoTerminal (fallback when DexScreener has none — e.g. Solana tokens). */
export async function fetchTokenImage(chainId: string, tokenAddress: string): Promise<string | null> {
  const network = toGeckoNetwork(chainId)
  if (!network || !tokenAddress) return null
  const key = `${network}/${tokenAddress}`
  if (imageCache.has(key)) return imageCache.get(key) ?? null
  try {
    const json = await gtGet<TokenInfoResponse>(`/networks/${network}/tokens/${tokenAddress}`)
    const url = json?.data?.attributes?.image_url
    const valid = typeof url === 'string' && url.length > 0 && !/missing/i.test(url) ? url : null
    imageCache.set(key, valid)
    return valid
  } catch {
    return null
  }
}
