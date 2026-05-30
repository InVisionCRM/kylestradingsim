import { useEffect, useRef, useState } from 'react'
import { useMarket } from '../state/useMarket'
import { useSim } from '../state/useSim'
import { useOrder } from '../state/useOrder'
import { useMarketData } from '../state/useMarketData'
import { useReplay } from '../state/useReplay'
import { useCurrentPrice, useActiveTokenKey } from '../hooks/useDerived'
import { SimError } from '../sim/errors'
import { formatQty, formatPrice, formatUsd } from '../lib/format'

function nowTs(mode: string): number {
  if (mode === 'replay') {
    return useMarketData.getState().candles[useReplay.getState().cursor]?.time ?? Math.floor(Date.now() / 1000)
  }
  return Math.floor(Date.now() / 1000)
}

export function OrderPanel() {
  const pair = useMarket((s) => s.activePair)
  const mode = useSim((s) => s.mode)
  const account = useSim((s) => s.accounts[s.mode])
  const settings = useSim((s) => s.settings)
  const price = useCurrentPrice()
  const activeKey = useActiveTokenKey()
  const side = useOrder((s) => s.side)
  const unit = useOrder((s) => s.unit)
  const focusTick = useOrder((s) => s.focusTick)
  const [amount, setAmount] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusTick > 0) inputRef.current?.focus()
  }, [focusTick])

  const position = activeKey ? account.positions[activeKey] : undefined
  const sym = pair?.baseToken.symbol ?? ''
  const amt = Number(amount) || 0
  const usdValue = unit === 'USD' ? amt : amt * (price ?? 0)
  const tokenQty = unit === 'TOKEN' ? amt : price ? amt / price : 0
  const fee = (usdValue * settings.feeBps) / 10000

  const setPct = (pct: number) => {
    if (side === 'buy') {
      const usd = account.cashUsd * pct
      setAmount(unit === 'USD' ? usd.toFixed(2) : price ? (usd / price).toFixed(4) : '')
    } else {
      const q = (position?.qty ?? 0) * pct
      setAmount(unit === 'TOKEN' ? q.toFixed(4) : price ? (q * price).toFixed(2) : '')
    }
  }

  const submit = () => {
    setErr(null)
    if (!pair) return setErr('Pick a token first')
    if (!price || price <= 0) return setErr('No live price yet — try again in a moment')
    try {
      if (side === 'buy') useSim.getState().buy(pair, price, usdValue, nowTs(mode))
      else useSim.getState().sell(pair, price, tokenQty, nowTs(mode))
      setAmount('')
    } catch (e) {
      setErr(e instanceof SimError ? e.message : e instanceof Error ? e.message : 'Order failed')
    }
  }

  const disabled = !price || amt <= 0

  return (
    <div className="order">
      <div className="bs">
        <button className={`buy ${side === 'buy' ? 'on' : ''}`} onClick={() => useOrder.getState().setSide('buy')}>
          BUY
        </button>
        <button className={`sell ${side === 'sell' ? 'on' : ''}`} onClick={() => useOrder.getState().setSide('sell')}>
          SELL
        </button>
      </div>

      <div className="fld">
        <div className="l">
          <span>AMOUNT</span>
          <span>
            {side === 'buy' ? `Cash ${formatUsd(account.cashUsd)}` : `Holding ${formatQty(position?.qty ?? 0)} ${sym}`}
          </span>
        </div>
        <div className="input">
          <input
            ref={inputRef}
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !disabled) submit()
            }}
          />
          <button className="cur" onClick={() => useOrder.getState().toggleUnit()}>
            {unit === 'USD' ? 'USD' : sym || 'TOKEN'} ⇄
          </button>
        </div>
      </div>

      <div className="pcts">
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <button key={p} onClick={() => setPct(p)}>
            {p === 1 ? 'MAX' : `${p * 100}%`}
          </button>
        ))}
      </div>

      <div className="approx">
        {side === 'buy' ? `≈ ${formatQty(tokenQty)} ${sym}` : `≈ ${formatUsd(usdValue)}`} · @ {formatPrice(price)}
      </div>

      <button className={`submit ${side}`} disabled={disabled} onClick={submit}>
        {side === 'buy' ? `BUY ${sym}` : `SELL ${sym}`}
      </button>

      <div className="subnote">
        <span>
          Fee {(settings.feeBps / 100).toFixed(2)}% · {formatUsd(fee)}
        </span>
        <span>{mode === 'replay' ? 'Replay fill' : 'Market'}</span>
      </div>
      {err && <div className="errline">{err}</div>}
    </div>
  )
}
