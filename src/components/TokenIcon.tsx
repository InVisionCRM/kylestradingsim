import { useState } from 'react'

const COLORS = ['#e8a03d', '#c9a27a', '#6fb7e0', '#2bb6a6', '#4aae5a', '#b98ce0', '#e06f8b', '#5ac1a0', '#d8a24a', '#7c9cf0']
function colorFor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

interface Props {
  src: string | null
  symbol: string
  size?: number
  cls?: string
}

export function TokenIcon({ src, symbol, size = 20, cls = 'ic' }: Props) {
  const [err, setErr] = useState(false)
  const style = { width: size, height: size }
  if (src && !err) return <img className={cls} src={src} alt="" style={style} onError={() => setErr(true)} />
  return (
    <span className={cls} style={{ ...style, background: colorFor(symbol || '?'), color: '#13110b' }}>
      {(symbol || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}
