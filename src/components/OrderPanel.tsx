import { useEffect, useRef, useState } from 'react'
import { useMarket } from '../state/useMarket'
import { useSim } from '../state/useSim'
import { useOrder } from '../state/useOrder'
import { useOrders } from '../state/useOrders'
import { useMarketData } from '../state/useMarketData'
import { useReplay } from '../state/useReplay'
import { useCurrentPrice, useActiveTokenKey } from '../hooks/useDerived'
import { SimError } from '../sim/errors'
import { refFromPair, tokenKeyOf } from '../types'
import { executionPrice, impactFraction } from '../sim/slippage'
import { formatQty, formatPrice, formatUsd } from '../lib/format'

type OType = 'market' | 'limit' | 'stop'

function nowTs(mode: string): number {
  if (mode === 'replay') return useMarketData.getState().candles[useReplay.getState().cursor]?.time ?? Math.floor(Date.now() / 1000)
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

  const [otype, setOtype] = useState<OType>('market')
  const [amount, setAmount] = useState('')
  const [trigger, setTrigger] = useState('')
  const [tp, setTp] = useState('')
  const [sl, setSl] = useState('')
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
  const trigPrice = Number(trigger) || 0

  const liquidity = pair?.liquidityUsd ?? null
  const refPrice = otype === 'market' ? price ?? 0 : trigPrice
  const sizeUsdEst = side === 'buy' ? usdValue : tokenQty * refPrice
  const impactF = settings.slippageOn ? impactFraction(sizeUsdEst, liquidity) : 0
  const fillAvg = refPrice > 0 ? (side === 'buy' ? refPrice * (1 + impactF) : refPrice / (1 + impactF)) : 0
  const recvTokens = side === 'buy' && fillAvg > 0 ? usdValue / fillAvg : 0
  const recvUsd = side === 'sell' ? tokenQty * fillAvg : 0

  const setPct = (pct: number) => {
    if (side === 'buy') {
      const usd = account.cashUsd * pct
      setAmount(unit === 'USD' ? usd.toFixed(2) : price ? (usd / price).toFixed(4) : '')
    } else {
      const q = (position?.qty ?? 0) * pct
      setAmount(unit === 'TOKEN' ? q.toFixed(4) : price ? (q * price).toFixed(2) : '')
    }
  }

  const placeBracket = () => {
    if (!pair) return
    const tpP = Number(tp) || 0
    const slP = Number(sl) || 0
    if (tpP <= 0 && slP <= 0) return
    const group = tpP > 0 && slP > 0 ? `oco${Date.now().toString(36)}` : null
    const base = {
      mode,
      tokenKey: tokenKeyOf(pair.chainId, pair.pairAddress),
      chainId: pair.chainId,
      pairAddress: pair.pairAddress,
      symbol: sym,
      imageUrl: pair.imageUrl,
      side: 'sell' as const,
      sizeUsd: null,
      sizeToken: null,
      reduceOnly: true,
      ocoGroup: group,
    }
    if (tpP > 0) useOrders.getState().place({ ...base, kind: 'tp', price: tpP })
    if (slP > 0) useOrders.getState().place({ ...base, kind: 'sl', price: slP })
  }

  const submit = () => {
    setErr(null)
    if (!pair) return setErr('Pick a token first')

    if (otype === 'market') {
      if (!price || price <= 0) return setErr('No live price yet — try again in a moment')
      try {
        if (side === 'buy') {
          const exec = settings.slippageOn ? executionPrice(price, usdValue, 'buy', liquidity) : price
          useSim.getState().buy(refFromPair(pair), exec, usdValue, nowTs(mode))
          placeBracket()
        } else {
          const exec = settings.slippageOn ? executionPrice(price, tokenQty * price, 'sell', liquidity) : price
          useSim.getState().sell(refFromPair(pair), exec, tokenQty, nowTs(mode))
        }
        setAmount('')
        setTp('')
        setSl('')
      } catch (e) {
        setErr(e instanceof SimError ? e.message : e instanceof Error ? e.message : 'Order failed')
      }
      return
    }

    // limit / stop → resting order
    if (trigPrice <= 0) return setErr('Enter a trigger price')
    if (amt <= 0) return setErr('Enter an amount')
    useOrders.getState().place({
      mode,
      tokenKey: tokenKeyOf(pair.chainId, pair.pairAddress),
      chainId: pair.chainId,
      pairAddress: pair.pairAddress,
      symbol: sym,
      imageUrl: pair.imageUrl,
      side,
      kind: otype,
      price: trigPrice,
      sizeUsd: side === 'buy' ? usdValue : null,
      sizeToken: side === 'sell' ? tokenQty : null,
      reduceOnly: false,
      ocoGroup: null,
    })
    if (side === 'buy') placeBracket()
    setAmount('')
    setTrigger('')
    setTp('')
    setSl('')
  }

  const disabled = otype === 'market' ? !price || amt <= 0 : trigPrice <= 0 || amt <= 0
  const submitLabel =
    otype === 'market' ? `${side === 'buy' ? 'BUY' : 'SELL'} ${sym}` : `Place ${side} ${otype}`

  return (
    <div className="order">
      <div className="otabs">
        {(['market', 'limit', 'stop'] as OType[]).map((t) => (
          <button key={t} className={otype === t ? 'on' : ''} onClick={() => setOtype(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="bs">
        <button className={`buy ${side === 'buy' ? 'on' : ''}`} onClick={() => useOrder.getState().setSide('buy')}>
          BUY
        </button>
        <button className={`sell ${side === 'sell' ? 'on' : ''}`} onClick={() => useOrder.getState().setSide('sell')}>
          SELL
        </button>
      </div>

      {otype !== 'market' && (
        <div className="fld">
          <div className="l">
            <span>TRIGGER PRICE</span>
            <span>mkt {formatPrice(price)}</span>
          </div>
          <div className="input">
            <input inputMode="decimal" placeholder="0.00" value={trigger} onChange={(e) => setTrigger(e.target.value.replace(/[^0-9.]/g, ''))} />
            <span className="cur">USD</span>
          </div>
        </div>
      )}

      <div className="fld">
        <div className="l">
          <span>AMOUNT</span>
          <span>{side === 'buy' ? `Cash ${formatUsd(account.cashUsd)}` : `Holding ${formatQty(position?.qty ?? 0)} ${sym}`}</span>
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

      {side === 'buy' && (
        <div className="bracket">
          <div className="bk">
            <span className="up">TP</span>
            <input inputMode="decimal" placeholder="price" value={tp} onChange={(e) => setTp(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
          <div className="bk">
            <span className="down">SL</span>
            <input inputMode="decimal" placeholder="price" value={sl} onChange={(e) => setSl(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
        </div>
      )}

      <div className="approx">
        {side === 'buy' ? `≈ ${formatQty(tokenQty)} ${sym}` : `≈ ${formatUsd(usdValue)}`}
        {otype === 'market' ? ` · @ ${formatPrice(price)}` : ` · trigger @ ${formatPrice(trigPrice || null)}`}
      </div>

      {settings.slippageOn && amt > 0 && refPrice > 0 && (
        <div className="slipline">
          <span>
            Price impact <b className={impactF > 0.03 ? 'down' : impactF > 0.01 ? 'warn' : ''}>{(impactF * 100).toFixed(2)}%</b>
          </span>
          <span>receive ≈ {side === 'buy' ? `${formatQty(recvTokens)} ${sym}` : formatUsd(recvUsd)}</span>
        </div>
      )}

      <button className={`submit ${side}`} disabled={disabled} onClick={submit}>
        {submitLabel}
      </button>

      <div className="subnote">
        <span>Fee {(settings.feeBps / 100).toFixed(2)}% · {formatUsd(fee)}</span>
        <button
          className={`sliptoggle ${settings.slippageOn ? 'on' : ''}`}
          onClick={() => useSim.getState().setSlippage(!settings.slippageOn)}
          title="Liquidity-aware slippage"
        >
          Slippage {settings.slippageOn ? 'ON' : 'OFF'}
        </button>
      </div>
      {err && <div className="errline">{err}</div>}
    </div>
  )
}
