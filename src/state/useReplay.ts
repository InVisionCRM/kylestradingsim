import { create } from 'zustand'

interface ReplayState {
  cursor: number
  playing: boolean
  speed: number
  length: number
  init: (length: number) => void
  setCursor: (n: number) => void
  play: () => void
  pause: () => void
  toggle: () => void
  step: (delta: number) => void
  setSpeed: (s: number) => void
}

/** Replay transport state. Not persisted — it's derived from the loaded candles. */
export const useReplay = create<ReplayState>((set, get) => ({
  cursor: 0,
  playing: false,
  speed: 2,
  length: 0,
  init: (length) =>
    set({ length, cursor: length > 1 ? Math.floor(length * 0.6) : Math.max(0, length - 1), playing: false }),
  setCursor: (n) => {
    const { length } = get()
    set({ cursor: Math.max(0, Math.min(length - 1, Math.round(n))) })
  },
  play: () => {
    if (get().length > 0) set({ playing: true })
  },
  pause: () => set({ playing: false }),
  toggle: () => set((s) => ({ playing: !s.playing && s.length > 0 })),
  step: (delta) => {
    const { cursor, length } = get()
    set({ cursor: Math.max(0, Math.min(length - 1, cursor + delta)), playing: false })
  },
  setSpeed: (speed) => set({ speed }),
}))
