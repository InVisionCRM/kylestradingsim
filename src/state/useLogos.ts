import { create } from 'zustand'

interface LogosState {
  /** resolved logo URL per tokenKey (DexScreener image, else GeckoTerminal fallback) */
  map: Record<string, string>
  set: (tokenKey: string, url: string) => void
}

export const useLogos = create<LogosState>((set) => ({
  map: {},
  set: (tokenKey, url) => set((s) => (s.map[tokenKey] === url ? s : { map: { ...s.map, [tokenKey]: url } })),
}))
