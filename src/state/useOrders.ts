import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mode, PendingOrder } from '../types'

let counter = 0
const oid = () => `o${Date.now().toString(36)}${(counter++).toString(36)}`

interface OrdersState {
  orders: Record<Mode, PendingOrder[]>
  place: (o: Omit<PendingOrder, 'id' | 'createdTs'>) => string
  cancel: (mode: Mode, id: string) => void
  cancelGroup: (mode: Mode, ocoGroup: string) => void
  updatePrice: (mode: Mode, id: string, price: number) => void
  clearToken: (mode: Mode, tokenKey: string) => void
}

export const useOrders = create<OrdersState>()(
  persist(
    (set) => ({
      orders: { live: [], replay: [] },
      place: (o) => {
        const id = oid()
        const order: PendingOrder = { ...o, id, createdTs: Math.floor(Date.now() / 1000) }
        set((s) => ({ orders: { ...s.orders, [o.mode]: [...(s.orders[o.mode] ?? []), order] } }))
        return id
      },
      cancel: (mode, id) => set((s) => ({ orders: { ...s.orders, [mode]: (s.orders[mode] ?? []).filter((o) => o.id !== id) } })),
      cancelGroup: (mode, ocoGroup) =>
        set((s) => ({ orders: { ...s.orders, [mode]: (s.orders[mode] ?? []).filter((o) => o.ocoGroup !== ocoGroup) } })),
      updatePrice: (mode, id, price) =>
        set((s) => ({ orders: { ...s.orders, [mode]: (s.orders[mode] ?? []).map((o) => (o.id === id ? { ...o, price } : o)) } })),
      clearToken: (mode, tokenKey) =>
        set((s) => ({ orders: { ...s.orders, [mode]: (s.orders[mode] ?? []).filter((o) => o.tokenKey !== tokenKey) } })),
    }),
    { name: 'paperdex.orders.v1' },
  ),
)
