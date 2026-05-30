// In dev we go through the Vite proxy (see vite.config.ts) to sidestep any CORS
// edge case. In production both APIs are public + CORS-enabled, so we hit them directly.
const DEV = import.meta.env.DEV
export const GT_BASE = DEV ? '/gt/api/v2' : 'https://api.geckoterminal.com/api/v2'
export const DS_BASE = DEV ? '/ds' : 'https://api.dexscreener.com'

export async function getJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } })
    if (res.status === 429) throw new Error('Rate limited — easing off for a moment.')
    if (!res.ok) throw new Error(`Request failed (${res.status})`)
    return (await res.json()) as T
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('Request timed out')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

// GeckoTerminal's public API allows ~30 requests/minute (IP-based). We serialize
// every GT call through a single promise chain with >=1.2s spacing so we never
// trip the limit, even with rapid timeframe switching.
let gtChain: Promise<unknown> = Promise.resolve()
let lastGtAt = 0

export function gtGet<T>(path: string): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = Math.max(0, 1200 - (Date.now() - lastGtAt))
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastGtAt = Date.now()
    return getJson<T>(`${GT_BASE}${path}`)
  }
  const p = gtChain.then(run, run)
  gtChain = p.catch(() => {})
  return p
}

export function dsGet<T>(path: string): Promise<T> {
  return getJson<T>(`${DS_BASE}${path}`)
}
