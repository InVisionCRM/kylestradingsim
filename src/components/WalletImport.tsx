import { useEffect, useState } from 'react'
import { useWallet } from '../state/useWallet'
import { useMarket } from '../state/useMarket'
import { useUi } from '../state/useUi'
import { getTokenTopPair } from '../api/dexscreener'
import { fetchWalletSwaps } from '../api/pulsex'
import { computeWalletPnl, type WalletTokenPnl } from '../lib/walletPnl'
import { ensureLogo } from '../lib/logos'
import type { TokenHolding } from '../api/blockscout'
import { formatQty, formatCompactUsd, formatUsd, formatPct, signClass } from '../lib/format'
import { TokenIcon } from './TokenIcon'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

const IconShare = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7 8l5-5 5 5M5 15v4h14v-4" />
  </svg>
)

/** Real per-token P&L from the wallet's actual PulseX swaps, flexable as cards. */
function WalletPnl({ address }: { address: string }) {
  const [rows, setRows] = useState<WalletTokenPnl[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setRows(null)
    setFailed(false)
    fetchWalletSwaps(address)
      .then(({ swaps, ok }) => {
        if (!alive) return
        if (!ok) setFailed(true)
        else setRows(computeWalletPnl(swaps).slice(0, 8))
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [address])

  if (failed) return <div className="wnote dim">PulseX P&amp;L unavailable right now.</div>
  if (rows === null) return <div className="wnote dim">Crunching PulseX trade history…</div>
  if (rows.length === 0) return null

  return (
    <>
      <div className="sechead" style={{ paddingTop: 8 }}>
        PULSEX P&amp;L · REAL
      </div>
      {rows.map((r) => (
        <button
          key={r.tokenAddress}
          className="wpnlrow"
          title={`${r.buys} buys · ${r.sells} sells — tap to flex`}
          onClick={() =>
            useUi.getState().openFlex({
              symbol: r.symbol,
              roiPct: r.roiPct,
              pnlUsd: r.realizedUsd,
              entryUsd: r.avgEntryUsd,
              markUsd: r.avgExitUsd,
              closed: true,
              wallet: short(address),
            })
          }
        >
          <span className="s">{r.symbol}</span>
          <span className={`num ${signClass(r.realizedUsd)}`}>{formatUsd(r.realizedUsd)}</span>
          <span className={`num pct ${signClass(r.roiPct)}`}>{formatPct(r.roiPct)}</span>
          <span className="fx">{IconShare}</span>
        </button>
      ))}
    </>
  )
}

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
          {chain === 'pulsechain' && <WalletPnl address={address!} />}
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
