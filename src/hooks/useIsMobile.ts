import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 768px)'

function subscribe(cb: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}

/** True on phone-sized viewports — switches the app between the mobile shell and the desktop grid. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
}
