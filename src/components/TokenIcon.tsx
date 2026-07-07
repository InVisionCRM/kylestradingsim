import { useEffect, useState } from 'react'
import { useLogos } from '../state/useLogos'

const COLORS = ['#e8a03d', '#c9a27a', '#6fb7e0', '#2bb6a6', '#4aae5a', '#b98ce0', '#e06f8b', '#5ac1a0', '#d8a24a', '#7c9cf0']
export function colorFor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

interface Props {
  symbol: string
  src?: string | null
  /** `chainId:pairAddress` — used to look up a resolved logo (DexScreener or GeckoTerminal fallback) */
  tokenKey?: string
  size?: number
  cls?: string
}

export function TokenIcon({ symbol, src, tokenKey, size = 20, cls = 'ic' }: Props) {
  const cached = useLogos((s) => (tokenKey ? s.map[tokenKey] : undefined))
  const resolved = cached ?? src ?? null
  const [err, setErr] = useState(false)
  useEffect(() => setErr(false), [resolved])

  const style = { width: size, height: size }
  if (resolved && !err) return <img className={cls} src={resolved} alt="" style={style} onError={() => setErr(true)} />
  return (
    <span className={cls} style={{ ...style, background: colorFor(symbol || '?'), color: '#13110b' }}>
      {(symbol || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}
