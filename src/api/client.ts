// In dev we go through the Vite proxy (see vite.config.ts) to sidestep any CORS
// edge case. In production both APIs are public + CORS-enabled, so we hit them directly.
const DEV = import.meta.env.DEV
export const GT_BASE = DEV ? '/gt/api/v2' : 'https://api.geckoterminal.com/api/v2'
export const DS_BASE = DEV ? '/ds' : 'https://api.dexscreener.com'

/** Thrown when the caller aborted — callers ignore it rather than surfacing an error. */
export class CancelledError extends Error {
  constructor() {
    super('cancelled')
    this.name = 'CancelledError'
  }
}

export async function getJson<T>(url: string, timeoutMs = 12000, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new CancelledError()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } })
    if (res.status === 429) throw new Error('Rate limited — easing off for a moment.')
    if (!res.ok) throw new Error(`Request failed (${res.status})`)
    return (await res.json()) as T
  } catch (e) {
    if (signal?.aborted) throw new CancelledError()
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('Request timed out')
    // Safari reports fetch network failures as TypeError("Load failed") — surface something human
    if (e instanceof TypeError) throw new Error("Can't reach the market data service")
    throw e
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

// GeckoTerminal's public API allows ~30 requests/minute (IP-based). We serialize
// every GT call through a single promise chain with >=1.2s spacing so we never
// trip the limit, even with rapid timeframe switching. Aborted calls are dropped
// from the queue instantly (no spacing consumed) so a superseded chart load
// can't starve the next one.
let gtChain: Promise<unknown> = Promise.resolve()
let lastGtAt = 0

export function gtGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const run = async (): Promise<T> => {
    if (signal?.aborted) throw new CancelledError()
    const wait = Math.max(0, 1200 - (Date.now() - lastGtAt))
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    if (signal?.aborted) throw new CancelledError()
    lastGtAt = Date.now()
    return getJson<T>(`${GT_BASE}${path}`, 12000, signal)
  }
  const p = gtChain.then(run, run)
  gtChain = p.catch(() => {})
  return p
}

export function dsGet<T>(path: string): Promise<T> {
  return getJson<T>(`${DS_BASE}${path}`)
}
