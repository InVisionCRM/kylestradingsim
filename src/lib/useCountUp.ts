import { useEffect, useRef, useState } from 'react'

/** Eases a number from 0 → value once, on mount / when value changes. */
export function useCountUp(value: number, durationMs = 900): number {
  const [v, setV] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (!isFinite(value)) {
      setV(value)
      return
    }
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs)
      const e = 1 - Math.pow(1 - p, 3)
      setV(value * e)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, durationMs])
  return v
}
