import { useEffect } from 'react'
import { useSim } from '../state/useSim'
import { useOrders } from '../state/useOrders'
import { useMarket } from '../state/useMarket'
import { useMarketData } from '../state/useMarketData'
import { useReplay } from '../state/useReplay'
import { usePrices } from '../state/usePrices'
import { shouldTrigger } from '../sim/orders'
import { tokenKeyOf, type PendingOrder, type TokenRef } from '../types'

function activeContext(): { activeKey: string | null; activePrice: number | null } {
  const market = useMarket.getState()
  const activeKey = market.activePair ? tokenKeyOf(market.activePair.chainId, market.activePair.pairAddress) : null
  const mode = useSim.getState().mode
  const md = useMarketData.getState()
  const rep = useReplay.getState()
  const activePrice =
    mode === 'replay'
      ? md.candles[rep.cursor]?.close ?? null
      : md.livePrice ?? md.candles[md.candles.length - 1]?.close ?? null
  return { activeKey, activePrice }
}

function priceFor(order: PendingOrder, activeKey: string | null, activePrice: number | null): number | null {
  if (order.tokenKey === activeKey) return activePrice
  return usePrices.getState().map[order.tokenKey] ?? null
}

function evaluate(): void {
  const mode = useSim.getState().mode
  const orders = useOrders.getState().orders[mode] ?? []
  if (!orders.length) return
  const { activeKey, activePrice } = activeContext()
  const ts =
    mode === 'replay'
      ? useMarketData.getState().candles[useReplay.getState().cursor]?.time ?? Math.floor(Date.now() / 1000)
      : Math.floor(Date.now() / 1000)

  for (const o of orders) {
    if (o.mode !== mode) continue
    const price = priceFor(o, activeKey, activePrice)
    if (price == null || !(price > 0) || !shouldTrigger(o, price)) continue

    const ref: TokenRef = { chainId: o.chainId, pairAddress: o.pairAddress, symbol: o.symbol, imageUrl: o.imageUrl }
    try {
      if (o.side === 'buy') {
        const usd = o.sizeUsd ?? 0
        if (usd <= 0) continue
        useSim.getState().buy(ref, price, usd, ts)
      } else {
        const held = useSim.getState().accounts[mode].positions[o.tokenKey]?.qty ?? 0
        if (o.reduceOnly && held <= 0) continue // nothing to close yet — keep waiting
        const qty = Math.min(o.sizeToken ?? held, held)
        if (qty <= 0) continue
        useSim.getState().sell(ref, price, qty, ts)
      }
      useOrders.getState().cancel(mode, o.id)
      if (o.ocoGroup) useOrders.getState().cancelGroup(mode, o.ocoGroup)
    } catch {
      // e.g. insufficient funds — drop the order rather than retrying forever
      useOrders.getState().cancel(mode, o.id)
    }
  }
}

/** Subscribes to price sources and fills triggered orders (live ticks + replay steps). */
export function useOrderEngine(): void {
  useEffect(() => {
    const unsubs = [
      useMarketData.subscribe(() => evaluate()),
      useReplay.subscribe(() => evaluate()),
      usePrices.subscribe(() => evaluate()),
      useSim.subscribe((s, p) => {
        if (s.mode !== p.mode) evaluate()
      }),
    ]
    evaluate()
    return () => unsubs.forEach((u) => u())
  }, [])
}
