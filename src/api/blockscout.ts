import { getJson } from './client'

// Blockscout v2. PulseChain's instance blocks direct cross-origin browser calls,
// so we reach Blockscout SERVER-SIDE — the same approach as the portfolio's
// /api/portfolio routes: in production through the Vercel function api/blockscout.js,
// in dev through the Vite proxy. Field shapes below are confirmed live.
export type EvmChain = 'pulsechain' | 'ethereum'

const DEV = import.meta.env.DEV
function bsUrl(chain: EvmChain, path: string): string {
  return DEV ? `/bs/${chain}${path}` : `/api/blockscout?chain=${chain}&path=${encodeURIComponent(path)}`
}

export const EVM_CHAINS: EvmChain[] = ['pulsechain', 'ethereum']
export const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/

export const EXPLORER_TX: Record<EvmChain, string> = {
  pulsechain: 'https://scan.pulsechain.com/tx/',
  ethereum: 'https://eth.blockscout.com/tx/',
}

/** A wallet's ERC-20 holding (one row of the WALLET group). */
export interface TokenHolding {
  address: string // token contract, lowercased
  symbol: string
  name: string
  decimals: number
  iconUrl: string | null
  balance: number // human units
  priceUsd: number | null // Blockscout exchange_rate (USD per token)
  valueUsd: number | null // balance * priceUsd
}

/** One on-chain ERC-20 transfer touching the wallet (raw, only the fields we read). */
export interface RawTransfer {
  timestamp: string
  transaction_hash: string
  from?: { hash?: string }
  to?: { hash?: string }
  total?: { value?: string; decimals?: string }
  token?: { address_hash?: string }
  type?: string
}

interface RawTokenInfo {
  address_hash?: string
  symbol?: string
  name?: string
  decimals?: string
  icon_url?: string | null
  exchange_rate?: string | null
  type?: string
}
interface RawHolding {
  token?: RawTokenInfo
  value?: string
}
interface Paged<T> {
  items?: T[]
  next_page_params?: Record<string, unknown> | null
}

/** Big-integer string ÷ 10^decimals → JS number (precision is fine for display + markers). */
function toUnits(raw: string | undefined, decimals: number): number {
  if (!raw) return 0
  const n = Number(raw)
  return isFinite(n) ? n / 10 ** decimals : 0
}

/** ERC-20 holdings for a wallet, richest first. Single page (top ~50) — enough for a list. */
export async function getTokenHoldings(chain: EvmChain, wallet: string): Promise<TokenHolding[]> {
  const data = await getJson<Paged<RawHolding>>(bsUrl(chain, `/addresses/${wallet}/tokens?type=ERC-20`))
  const out: TokenHolding[] = []
  for (const it of data.items ?? []) {
    const t = it.token ?? {}
    const address = (t.address_hash ?? '').toLowerCase()
    if (!address) continue
    const decimals = Number(t.decimals ?? '0') || 0
    const balance = toUnits(it.value, decimals)
    if (!(balance > 0)) continue
    const rate = t.exchange_rate != null && t.exchange_rate !== '' ? Number(t.exchange_rate) : NaN
    const priceUsd = isFinite(rate) ? rate : null
    out.push({
      address,
      symbol: t.symbol ?? '?',
      name: t.name ?? '',
      decimals,
      iconUrl: t.icon_url ?? null,
      balance,
      priceUsd,
      valueUsd: priceUsd != null ? balance * priceUsd : null,
    })
  }
  // richest first; unknown-value tokens sink to the bottom
  return out.sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1))
}

// Safety valve so a pathological wallet can't spin forever (~100 pages * 50 = 5000 transfers).
const MAX_PAGES = 100

/** Every ERC-20 transfer of one token in/out of a wallet — full history, paged. */
export async function getTokenTransfers(chain: EvmChain, wallet: string, token: string): Promise<RawTransfer[]> {
  const all: RawTransfer[] = []
  let query: Record<string, string> = { token, type: 'ERC-20' }

  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = new URLSearchParams(query).toString()
    const data = await getJson<Paged<RawTransfer>>(bsUrl(chain, `/addresses/${wallet}/token-transfers?${qs}`))
    all.push(...(data.items ?? []))
    const next = data.next_page_params
    if (!next) break
    query = { token, type: 'ERC-20' }
    for (const [k, v] of Object.entries(next)) if (v != null) query[k] = String(v)
    await new Promise((r) => setTimeout(r, 250)) // gentle on the public API
  }
  return all
}
