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

/**
 * Historical OHLCV candles from GeckoTerminal, normalized to ascending,
 * de-duplicated `Candle[]` ready for Lightweight Charts.
 */
export async function fetchOhlcv(chainId: string, poolAddress: string, tf: Timeframe): Promise<Candle[]> {
  const network = toGeckoNetwork(chainId)
  if (!network) throw new Error(`Charts aren't supported for chain "${chainId}" yet`)

  const conf = TF[tf]
  const key = `${network}/${poolAddress}/${tf}`
  const ttl = Math.min(conf.seconds, 60) * 1000
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.data

  const path = `/networks/${network}/pools/${poolAddress}/ohlcv/${conf.path}?aggregate=${conf.aggregate}&limit=300&currency=usd&token=base`
  const json = await gtGet<OhlcvResponse>(path)
  const list = json?.data?.attributes?.ohlcv_list ?? []

  const candles: Candle[] = list
    .map((r) => ({
      time: Number(r[0]),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }))
    .filter((c) => isFinite(c.time) && isFinite(c.close) && c.close > 0)
    .sort((a, b) => a.time - b.time)

  // Strictly ascending, unique times (Lightweight Charts requirement).
  const out: Candle[] = []
  for (const c of candles) {
    if (!out.length || out[out.length - 1].time !== c.time) out.push(c)
    else out[out.length - 1] = c
  }

  cache.set(key, { at: Date.now(), data: out })
  return out
}
