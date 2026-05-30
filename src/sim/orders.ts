import type { OrderKind, Side } from '../types'

/**
 * Which way price must cross for an order to fill:
 *  - limit buy  → fill when price drops to/below the level   (below)
 *  - limit sell → fill when price rises to/above the level    (above)
 *  - stop buy   → breakout entry, fill on cross up            (above)
 *  - stop sell  → stop-loss, fill on cross down               (below)
 *  - tp (reduce-only sell) → fill on cross up                 (above)
 *  - sl (reduce-only sell) → fill on cross down               (below)
 */
export function triggerDir(o: { kind: OrderKind; side: Side }): 'above' | 'below' {
  if (o.kind === 'tp') return 'above'
  if (o.kind === 'sl') return 'below'
  if (o.kind === 'limit') return o.side === 'sell' ? 'above' : 'below'
  return o.side === 'buy' ? 'above' : 'below' // stop
}

export function shouldTrigger(o: { kind: OrderKind; side: Side; price: number }, price: number): boolean {
  if (!(price > 0)) return false
  return triggerDir(o) === 'above' ? price >= o.price : price <= o.price
}

const KIND_LABEL: Record<OrderKind, string> = { limit: 'Limit', stop: 'Stop', tp: 'Take profit', sl: 'Stop loss' }
export function orderLabel(o: { kind: OrderKind; side: Side }): string {
  if (o.kind === 'tp' || o.kind === 'sl') return KIND_LABEL[o.kind]
  return `${o.side === 'buy' ? 'Buy' : 'Sell'} ${KIND_LABEL[o.kind].toLowerCase()}`
}
