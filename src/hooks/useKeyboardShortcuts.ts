import { useEffect } from 'react'
import { useSim } from '../state/useSim'
import { useReplay } from '../state/useReplay'
import { useOrder } from '../state/useOrder'

/**
 * Global keyboard shortcuts (ignored while typing in an input):
 *   Space         play/pause replay
 *   ← / →         step replay back / forward
 *   B / S         set order side to buy / sell and focus the amount field
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

      const mode = useSim.getState().mode
      switch (e.key) {
        case ' ':
          if (mode === 'replay') {
            e.preventDefault()
            useReplay.getState().toggle()
          }
          break
        case 'ArrowLeft':
          if (mode === 'replay') {
            e.preventDefault()
            useReplay.getState().step(-1)
          }
          break
        case 'ArrowRight':
          if (mode === 'replay') {
            e.preventDefault()
            useReplay.getState().step(1)
          }
          break
        case 'b':
        case 'B':
          useOrder.getState().setSide('buy')
          useOrder.getState().requestFocus()
          break
        case 's':
        case 'S':
          useOrder.getState().setSide('sell')
          useOrder.getState().requestFocus()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
