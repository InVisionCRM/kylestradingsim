import { useEffect } from 'react'
import { useMarket } from '../state/useMarket'
import { useMarketData } from '../state/useMarketData'
import { useReplay } from '../state/useReplay'
import { useSim } from '../state/useSim'
import { usePrices } from '../state/usePrices'
import { fetchOhlcv } from '../api/geckoterminal'
import { getPair } from '../api/dexscreener'
import { ensureLogo } from '../lib/logos'
import { tokenKeyOf } from '../types'

/** Loads OHLCV whenever the active pair or timeframe changes; resets the replay timeline. */
export function useCandlesLoader(): void {
  const chainId = useMarket((s) => s.activePair?.chainId)
  const pairAddress = useMarket((s) => s.activePair?.pairAddress)
  const tf = useMarket((s) => s.timeframe)

  useEffect(() => {
    if (!chainId || !pairAddress) return
    let alive = true
    const md = useMarketData.getState()
    md.setLoading(true)
    md.setError(null)
    md.setLivePrice(null)

    fetchOhlcv(chainId, pairAddress, tf)
      .then((candles) => {
        if (!alive) return
        md.setCandles(candles)
        md.setLoading(false)
        useReplay.getState().init(candles.length)
      })
      .catch((e: unknown) => {
        if (!alive) return
        md.setCandles([])
        md.setError(e instanceof Error ? e.message : 'Failed to load chart')
        md.setLoading(false)
        useReplay.getState().init(0)
      })

    return () => {
      alive = false
    }
  }, [chainId, pairAddress, tf])
}

/** Polls live price (and refreshes pair stats) every 5s while in live mode. */
export function useLivePriceLoader(): void {
  const chainId = useMarket((s) => s.activePair?.chainId)
  const pairAddress = useMarket((s) => s.activePair?.pairAddress)
  const mode = useSim((s) => s.mode)

  useEffect(() => {
    if (!chainId || !pairAddress || mode !== 'live') return
    let alive = true

    const poll = async () => {
      try {
        const p = await getPair(chainId, pairAddress)
        if (!alive || !p) return
        useMarketData.getState().setLivePrice(p.priceUsd)
        useMarket.getState().setActivePair(p)
        if (p.priceUsd) usePrices.getState().setPrice(tokenKeyOf(p.chainId, p.pairAddress), p.priceUsd)
        ensureLogo(p)
      } catch {
        /* transient — keep last known price */
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [chainId, pairAddress, mode])
}

/** Advances the replay cursor while playing. */
export function useReplayClock(): void {
  const mode = useSim((s) => s.mode)
  const playing = useReplay((s) => s.playing)
  const speed = useReplay((s) => s.speed)
  const length = useReplay((s) => s.length)

  useEffect(() => {
    if (mode !== 'replay' || !playing || length <= 0) return
    const interval = Math.max(60, 700 / speed)
    const id = setInterval(() => {
      const r = useReplay.getState()
      if (r.cursor >= r.length - 1) r.pause()
      else useReplay.setState({ cursor: r.cursor + 1 })
    }, interval)
    return () => clearInterval(id)
  }, [mode, playing, speed, length])
}

/**
 * Keeps a live price for EVERY token held in the live account, so total equity and
 * per-position P&L are correct regardless of which token is selected.
 */
export function usePositionPricesLoader(): void {
  const positionKeys = useSim((s) => Object.keys(s.accounts.live.positions).join(','))

  useEffect(() => {
    if (!positionKeys) return
    let alive = true
    const load = async () => {
      const positions = useSim.getState().accounts.live.positions
      for (const pos of Object.values(positions)) {
        try {
          const p = await getPair(pos.chainId, pos.pairAddress)
          if (!alive || !p) continue
          if (p.priceUsd) usePrices.getState().setPrice(pos.tokenKey, p.priceUsd)
          ensureLogo(p)
        } catch {
          /* transient */
        }
      }
    }
    load()
    const id = setInterval(load, 20000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [positionKeys])
}
