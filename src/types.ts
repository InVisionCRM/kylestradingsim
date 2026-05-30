export type Mode = 'live' | 'replay'
export type Side = 'buy' | 'sell'
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

/** One OHLCV bar. `time` is a unix timestamp in SECONDS (Lightweight Charts format). */
export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Token {
  address: string
  name: string
  symbol: string
}

/** A normalized DEX pair (pool) — the unit a user trades and charts. */
export interface Pair {
  chainId: string
  dexId: string
  pairAddress: string
  url: string | null
  baseToken: Token
  quoteToken: Token
  priceUsd: number | null
  priceNative: number | null
  liquidityUsd: number | null
  fdv: number | null
  marketCap: number | null
  volume24h: number | null
  priceChange24h: number | null
  imageUrl: string | null
  socials: { type: string; url: string }[]
  pairCreatedAt: number | null
}

/** `${chainId}:${pairAddress}` */
export type TokenKey = string

export interface Position {
  tokenKey: TokenKey
  chainId: string
  pairAddress: string
  symbol: string
  imageUrl: string | null
  qty: number
  avgEntryUsd: number
  realizedPnlUsd: number
}

export interface Trade {
  id: string
  ts: number
  mode: Mode
  tokenKey: TokenKey
  symbol: string
  side: Side
  qtyToken: number
  priceUsd: number
  valueUsd: number
  feeUsd: number
}

export interface Account {
  startingBalanceUsd: number
  cashUsd: number
  realizedPnlUsd: number
  positions: Record<TokenKey, Position>
  trades: Trade[]
}

export interface WatchItem {
  chainId: string
  pairAddress: string
  symbol: string
  imageUrl: string | null
}

export function tokenKeyOf(chainId: string, pairAddress: string): TokenKey {
  return `${chainId}:${pairAddress}`
}

/** Minimal token identity needed to place a trade (lighter than a full Pair). */
export interface TokenRef {
  chainId: string
  pairAddress: string
  symbol: string
  imageUrl: string | null
}

export function refFromPair(pair: Pair): TokenRef {
  return { chainId: pair.chainId, pairAddress: pair.pairAddress, symbol: pair.baseToken.symbol, imageUrl: pair.imageUrl }
}

export type OrderKind = 'limit' | 'stop' | 'tp' | 'sl'

/** A resting order that fills when price crosses its trigger. */
export interface PendingOrder {
  id: string
  createdTs: number
  mode: Mode
  tokenKey: TokenKey
  chainId: string
  pairAddress: string
  symbol: string
  imageUrl: string | null
  side: Side
  kind: OrderKind
  price: number // trigger price (USD)
  sizeUsd: number | null // for buys (USD to spend)
  sizeToken: number | null // for sells (token qty); null + reduceOnly = whole position
  reduceOnly: boolean // TP/SL close an existing position
  ocoGroup: string | null // TP & SL share a group (one fills → cancel the other)
}
