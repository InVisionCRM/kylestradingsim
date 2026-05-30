import { useState } from 'react'
import { useWallet } from '../state/useWallet'
import { useMarket } from '../state/useMarket'
import { getTokenTopPair } from '../api/dexscreener'
import { ensureLogo } from '../lib/logos'
import type { TokenHolding } from '../api/blockscout'
import { formatQty, formatCompactUsd } from '../lib/format'
import { TokenIcon } from './TokenIcon'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function WalletImport() {
  const address = useWallet((s) => s.address)
  const chain = useWallet((s) => s.chain)
  const holdings = useWallet((s) => s.holdings)
  const status = useWallet((s) => s.status)
  const error = useWallet((s) => s.error)
  const showOverlay = useWallet((s) => s.showOverlay)
  const activeAddr = useMarket((s) => s.activePair?.baseToken.address?.toLowerCase() ?? null)
  const tradesLoading = useWallet((s) => s.tradesLoading)
  const tradesCount = useWallet((s) => s.trades.length)

  const [input, setInput] = useState('')
  const [resolving, setResolving] = useState<string | null>(null)
  const [rowErr, setRowErr] = useState<string | null>(null)

  const connected = !!address && holdings.length > 0

  const doImport = () => {
    if (!input.trim()) return
    void useWallet.getState().importWallet(input)
  }

  const openToken = async (h: TokenHolding) => {
    if (!chain) return
    setResolving(h.address)
    setRowErr(null)
    try {
      const pair = await getTokenTopPair(chain, h.address)
      if (!pair) {
        setRowErr(`No tradeable market for ${h.symbol}`)
        return
      }
      ensureLogo(pair)
      useMarket.getState().setActivePair(pair)
    } catch {
      setRowErr(`Couldn't load ${h.symbol}`)
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="wallet">
      <div className="sechead row-between">
        <span>WALLET</span>
        {connected && (
          <div className="wctl">
            <button
              className={`wovl ${showOverlay ? 'on' : ''}`}
              title="Show this wallet's buys & sells on the chart"
              onClick={() => useWallet.getState().toggleOverlay()}
            >
              {showOverlay ? '◉' : '◌'} chart
            </button>
            <button className="rm" title="Disconnect wallet" onClick={() => useWallet.getState().clear()}>
              ×
            </button>
          </div>
        )}
      </div>

      {!connected && (
        <div className="wimport">
          <div className="winput">
            <input
              inputMode="text"
              placeholder="Paste 0x wallet address"
              spellCheck={false}
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doImport()
              }}
            />
            <button className="wgo" disabled={status === 'loading' || !input.trim()} onClick={doImport}>
              {status === 'loading' ? '…' : 'Import'}
            </button>
          </div>
          {status === 'loading' && <div className="wnote">Scanning PulseChain &amp; Ethereum…</div>}
          {status === 'error' && error && <div className="wnote err">{error}</div>}
          {status === 'idle' && <div className="wnote dim">Pull a wallet's tokens, then plot its on-chain trades.</div>}
        </div>
      )}

      {connected && (
        <>
          <div className="wmeta">
            <span className="waddr">{short(address!)}</span>
            <span className={`wchain ${chain}`}>{chain === 'pulsechain' ? 'PLS' : 'ETH'}</span>
            <span className="wcount">{holdings.length} tokens</span>
          </div>
          {(tradesLoading || tradesCount > 0) && (
            <div className="wnote dim">
              {tradesLoading ? 'Loading on-chain trades…' : `${tradesCount} trades on chart`}
            </div>
          )}
          {rowErr && <div className="wnote err">{rowErr}</div>}
          <div className="wlist scroll">
            {holdings.map((h) => {
              const key = `${chain}:${h.address}`
              const on = activeAddr === h.address
              return (
                <div className={`row ${on ? 'sel' : ''}`} key={key} onClick={() => openToken(h)}>
                  <TokenIcon symbol={h.symbol} src={h.iconUrl} tokenKey={key} size={20} />
                  <span className="s">{h.symbol}</span>
                  <div className="meta">
                    <div className="p num">{formatQty(h.balance)}</div>
                    <div className="c num dim">{h.valueUsd != null ? formatCompactUsd(h.valueUsd) : ' '}</div>
                  </div>
                  {resolving === h.address && <span className="wspin">…</span>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
