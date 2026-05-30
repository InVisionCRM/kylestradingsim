import type { Account, Mode, Position, Trade } from '../types'
import { InsufficientFundsError, InvalidOrderError, OversellError } from './errors'

const EPS = 1e-9

export function newAccount(startingBalanceUsd: number): Account {
  return { startingBalanceUsd, cashUsd: startingBalanceUsd, realizedPnlUsd: 0, positions: {}, trades: [] }
}

let counter = 0
function tradeId(): string {
  return `${Date.now().toString(36)}-${(counter++).toString(36)}`
}

export interface BuyInput {
  tokenKey: string
  chainId: string
  pairAddress: string
  symbol: string
  imageUrl: string | null
  priceUsd: number
  usdAmount: number
  feeBps: number
  mode: Mode
  ts: number
}

export interface SellInput {
  tokenKey: string
  priceUsd: number
  qtyToken: number
  feeBps: number
  mode: Mode
  ts: number
}

/** Market buy. Throws on bad price / no amount / insufficient cash. Returns a new Account. */
export function applyBuy(acc: Account, i: BuyInput): Account {
  if (!(i.priceUsd > 0)) throw new InvalidOrderError('No live price for this token yet')
  if (!(i.usdAmount > 0)) throw new InvalidOrderError('Enter an amount')

  const fee = (i.usdAmount * i.feeBps) / 10000
  const cost = i.usdAmount + fee
  if (cost > acc.cashUsd + EPS) throw new InsufficientFundsError('Not enough cash for this order')

  const tokens = i.usdAmount / i.priceUsd
  const prev = acc.positions[i.tokenKey]
  const prevQty = prev?.qty ?? 0
  const newQty = prevQty + tokens
  const prevCost = prevQty * (prev?.avgEntryUsd ?? 0)
  const avgEntryUsd = (prevCost + i.usdAmount) / newQty

  const position: Position = {
    tokenKey: i.tokenKey,
    chainId: i.chainId,
    pairAddress: i.pairAddress,
    symbol: i.symbol,
    imageUrl: i.imageUrl,
    qty: newQty,
    avgEntryUsd,
    realizedPnlUsd: prev?.realizedPnlUsd ?? 0,
  }
  const trade: Trade = {
    id: tradeId(),
    ts: i.ts,
    mode: i.mode,
    tokenKey: i.tokenKey,
    symbol: i.symbol,
    side: 'buy',
    qtyToken: tokens,
    priceUsd: i.priceUsd,
    valueUsd: i.usdAmount,
    feeUsd: fee,
  }
  return {
    ...acc,
    cashUsd: acc.cashUsd - cost,
    positions: { ...acc.positions, [i.tokenKey]: position },
    trades: [trade, ...acc.trades],
  }
}

/** Market sell. Throws on bad price / no position / oversell. Returns a new Account. */
export function applySell(acc: Account, i: SellInput): Account {
  if (!(i.priceUsd > 0)) throw new InvalidOrderError('No live price for this token yet')
  const prev = acc.positions[i.tokenKey]
  if (!prev || prev.qty <= 0) throw new OversellError('No position to sell')
  if (i.qtyToken > prev.qty + EPS) throw new OversellError("You can't sell more than you hold")

  const qty = Math.min(i.qtyToken, prev.qty)
  const proceeds = qty * i.priceUsd
  const fee = (proceeds * i.feeBps) / 10000
  const net = proceeds - fee
  const realized = (i.priceUsd - prev.avgEntryUsd) * qty - fee
  const remaining = prev.qty - qty

  const positions = { ...acc.positions }
  if (remaining <= 1e-12) delete positions[i.tokenKey]
  else positions[i.tokenKey] = { ...prev, qty: remaining, realizedPnlUsd: prev.realizedPnlUsd + realized }

  const trade: Trade = {
    id: tradeId(),
    ts: i.ts,
    mode: i.mode,
    tokenKey: i.tokenKey,
    symbol: prev.symbol,
    side: 'sell',
    qtyToken: qty,
    priceUsd: i.priceUsd,
    valueUsd: proceeds,
    feeUsd: fee,
  }
  return {
    ...acc,
    cashUsd: acc.cashUsd + net,
    realizedPnlUsd: acc.realizedPnlUsd + realized,
    positions,
    trades: [trade, ...acc.trades],
  }
}

export function unrealizedPnl(p: Position, price: number): number {
  return (price - p.avgEntryUsd) * p.qty
}

export function positionValue(p: Position, price: number): number {
  return p.qty * price
}

/**
 * Total account equity = cash + market value of all positions.
 * For tokens without a known live price, falls back to cost basis (avg entry).
 */
export function accountEquity(acc: Account, priceFor: (tokenKey: string) => number | null | undefined): number {
  let equity = acc.cashUsd
  for (const p of Object.values(acc.positions)) {
    const px = priceFor(p.tokenKey)
    equity += p.qty * (px != null && px > 0 ? px : p.avgEntryUsd)
  }
  return equity
}
