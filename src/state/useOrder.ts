import { create } from 'zustand'
import type { Side } from '../types'

interface OrderState {
  side: Side
  unit: 'USD' | 'TOKEN'
  focusTick: number
  setSide: (s: Side) => void
  setUnit: (u: 'USD' | 'TOKEN') => void
  toggleUnit: () => void
  requestFocus: () => void
}

/** Order-ticket UI state, shared so keyboard shortcuts can drive it. */
export const useOrder = create<OrderState>((set) => ({
  side: 'buy',
  unit: 'USD',
  focusTick: 0,
  setSide: (side) => set({ side }),
  setUnit: (unit) => set({ unit }),
  toggleUnit: () => set((s) => ({ unit: s.unit === 'USD' ? 'TOKEN' : 'USD' })),
  requestFocus: () => set((s) => ({ focusTick: s.focusTick + 1 })),
}))
