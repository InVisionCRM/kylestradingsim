import { useEffect, useRef, useState } from 'react'
import { useMarket } from '../state/useMarket'
import { useSim } from '../state/useSim'
import { useEquity, useCurrentPrice } from '../hooks/useDerived'
import { formatPriceUsd, formatUsd, formatPct, signClass } from '../lib/format'
import { TokenIcon } from './TokenIcon'
import { TokenSearch } from './TokenSearch'
import type { Mode } from '../types'

function useFlash(value: number | null): string {
  const [cls, setCls] = useState('')
  const prev = useRef<number | null>(null)
  useEffect(() => {
    const p = prev.current
    if (value != null && p != null && value !== p) {
      setCls(value > p ? 'tick-up' : 'tick-down')
      prev.current = value
      const id = setTimeout(() => setCls(''), 600)
      return () => clearTimeout(id)
    }
    prev.current = value
  }, [value])
  return cls
}

export function TopBar() {
  const pair = useMarket((s) => s.activePair)
  const mode = useSim((s) => s.mode)
  const price = useCurrentPrice()
  const { equity, totalPnl, startingBalance } = useEquity()
  const flash = useFlash(price)
  const [confirm, setConfirm] = useState(false)

  const setMode = (m: Mode) => useSim.getState().setMode(m)
  const pnlPct = startingBalance ? (totalPnl / startingBalance) * 100 : 0

  return (
    <>
      <div className="topbar">
        <div className="logo">
          <span className="mark" />
          PAPERDEX
        </div>
        <TokenSearch />
        {pair && (
          <div className="tk">
            <TokenIcon src={pair.imageUrl} symbol={pair.baseToken.symbol} size={24} />
            <div>
              <span className="sym">{pair.baseToken.symbol}</span>{' '}
              <span className="nm">{pair.baseToken.name || pair.chainId}</span>
            </div>
            <span className={`px num ${flash}`}>{formatPriceUsd(price)}</span>
            {pair.priceChange24h != null && (
              <span className={`pill ${signClass(pair.priceChange24h)}`}>{formatPct(pair.priceChange24h)}</span>
            )}
          </div>
        )}
        <div className="spacer" />
        <div className="modes">
          <button className={mode === 'live' ? 'on' : ''} onClick={() => setMode('live')}>
            Live
          </button>
          <button className={mode === 'replay' ? 'on' : ''} onClick={() => setMode('replay')}>
            Replay
          </button>
        </div>
        <div className="equity">
          <div className="lab">EQUITY · {mode.toUpperCase()}</div>
          <div className="v num">
            {formatUsd(equity)} <span className={signClass(totalPnl)} style={{ fontSize: 11 }}>{formatPct(pnlPct)}</span>
          </div>
        </div>
        <button className="iconbtn" title="Reset account" onClick={() => setConfirm(true)}>
          ⟲
        </button>
      </div>

      {confirm && (
        <div className="confirm-overlay" onClick={() => setConfirm(false)}>
          <div className="confirm" onClick={(e) => e.stopPropagation()}>
            <h3>Reset {mode} account?</h3>
            <p>
              Clears your {mode} positions and trade history and restores the ${startingBalance.toLocaleString()} starting
              balance. Your other account is untouched.
            </p>
            <div className="actions">
              <button onClick={() => setConfirm(false)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  useSim.getState().reset(mode)
                  setConfirm(false)
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
