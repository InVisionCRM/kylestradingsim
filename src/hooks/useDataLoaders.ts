import { useEffect } from 'react'
import { useMarket } from '../state/useMarket'
import { useMarketData } from '../state/useMarketData'
import { useReplay } from '../state/useReplay'
import { useSim } from '../state/useSim'
import { usePrices } from '../state/usePrices'
import { fetchOhlcvPaged } from '../api/geckoterminal'
import { CancelledError } from '../api/client'
import { getPair } from '../api/dexscreener'
import { fetchTape } from '../api/pulsex'
import { useTape } from '../state/useTape'
import { ensureLogo } from '../lib/logos'
import { tokenKeyOf } from '../types'

/**
 * Loads OHLCV whenever the active pair or timeframe changes.
 *
 * - Progressive: the chart renders after the first page (~1000 bars); deeper
 *   history streams in behind it (the chart prepends without moving the view).
 * - Stale-while-loading: a timeframe switch keeps the old series on screen
 *   until the new one arrives; only a token switch blanks the chart.
 * - Cancellable: switching again aborts the previous load immediately, so the
 *   rate-limit queue never backs up.
 */
export function useCandlesLoader(): void {
  const chainId = useMarket((s) => s.activePair?.chainId)
  const pairAddress = useMarket((s) => s.activePair?.pairAddress)
  const tf = useMarket((s) => s.timeframe)
  const reloadTick = useMarketData((s) => s.reloadTick)

  useEffect(() => {
    if (!chainId || !pairAddress) return
    let alive = true
    const ctrl = new AbortController()
    const pairKey = tokenKeyOf(chainId, pairAddress)
    const md = useMarketData.getState()
    md.setLoading(true)
    md.setError(null)
    md.setLivePrice(null)
    if (md.candlesFor !== pairKey) {
      // different token — the old series is meaningless, blank right away
      md.setCandles([], null)
      useReplay.getState().init(0)
    }

    let firstPage = true
    fetchOhlcvPaged(
      chainId,
      pairAddress,
      tf,
      (candles, done) => {
        if (!alive) return
        const store = useMarketData.getState()
        store.setCandles(candles, pairKey)
        store.setError(null)
        if (done) store.setLoading(false)
        if (firstPage) {
          firstPage = false
          useReplay.getState().init(candles.length)
        } else {
          useReplay.getState().extend(candles.length)
        }
      },
      ctrl.signal,
    ).catch((e: unknown) => {
      if (!alive || e instanceof CancelledError) return
      const store = useMarketData.getState()
      store.setLoading(false)
      store.setError(e instanceof Error ? e.message : 'Failed to load chart')
      // keep whatever series is on screen (old timeframe or partial pages) —
      // a dead chart is worse than a stale one
    })

    return () => {
      alive = false
      ctrl.abort()
    }
  }, [chainId, pairAddress, tf, reloadTick])
}

/** Polls live price (and refreshes pair stats) every 5s while in live mode; paused while the tab is hidden. */
export function useLivePriceLoader(): void {
  const chainId = useMarket((s) => s.activePair?.chainId)
  const pairAddress = useMarket((s) => s.activePair?.pairAddress)
  const mode = useSim((s) => s.mode)

  useEffect(() => {
    if (!chainId || !pairAddress || mode !== 'live') return
    let alive = true

    const poll = async () => {
      if (document.hidden) return
      try {
        const p = await getPair(chainId, pairAddress)
        if (!alive || !p) return
        useMarketData.getState().setLivePrice(p.priceUsd)
        useMarket.getState().setActivePair(p)
        if (p.priceUsd) usePrices.getState().setPrice(tokenKeyOf(p.chainId, p.pairAddress), p.priceUsd, p.liquidityUsd)
        ensureLogo(p)
      } catch {
        /* transient — keep last known price */
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    const onVis = () => {
      if (!document.hidden) poll()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [chainId, pairAddress, mode])
}

/**
 * Live trade tape for PulseChain (PulseX) pairs — polls the PulseX subgraphs
 * every 10s while the tab is visible. Other chains get an empty tape.
 */
export function useTradeTapeLoader(): void {
  const chainId = useMarket((s) => s.activePair?.chainId)
  const pairAddress = useMarket((s) => s.activePair?.pairAddress)
  const baseAddress = useMarket((s) => s.activePair?.baseToken.address)

  useEffect(() => {
    if (chainId !== 'pulsechain' || !pairAddress || !baseAddress) {
      useTape.getState().reset(null)
      return
    }
    let alive = true
    let inFlight = false
    useTape.getState().reset(tokenKeyOf(chainId, pairAddress))

    const poll = async () => {
      if (document.hidden || inFlight) return
      inFlight = true
      try {
        const { trades, ok } = await fetchTape(pairAddress, baseAddress)
        if (!alive) return
        if (ok) useTape.getState().merge(trades)
        else useTape.getState().setError(true)
      } catch {
        if (alive) useTape.getState().setError(true)
      } finally {
        inFlight = false
      }
    }
    poll()
    const id = setInterval(poll, 10000)
    const onVis = () => {
      if (!document.hidden) poll()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [chainId, pairAddress, baseAddress])
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
      if (document.hidden) return
      const positions = useSim.getState().accounts.live.positions
      for (const pos of Object.values(positions)) {
        try {
          const p = await getPair(pos.chainId, pos.pairAddress)
          if (!alive || !p) continue
          if (p.priceUsd) usePrices.getState().setPrice(pos.tokenKey, p.priceUsd, p.liquidityUsd)
          ensureLogo(p)
        } catch {
          /* transient */
        }
      }
    }
    load()
    const id = setInterval(load, 20000)
    const onVis = () => {
      if (!document.hidden) load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [positionKeys])
}
