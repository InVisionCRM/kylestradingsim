import { useEffect, useState } from 'react'
import { formatCompactUsd } from '../lib/format'

function useMounted(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return m
}

const GREEN = '#2ee6a6'
const RED = '#f87171'

/** Cumulative P&L area + line, draws in on mount. `data` is cumulative values incl a leading 0. */
export function AreaCurve({ data }: { data: number[] }) {
  const m = useMounted()
  const W = 620
  const H = 180
  const padT = 12
  const padB = 10
  if (data.length < 2) return <div className="center-msg" style={{ height: H }}>Not enough closed trades yet.</div>

  const min = Math.min(0, ...data)
  const max = Math.max(0, ...data)
  const range = max - min || 1
  const plotH = H - padT - padB
  const x = (i: number) => (i / (data.length - 1)) * W
  const y = (v: number) => padT + (1 - (v - min) / range) * plotH
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const z = y(0)
  const area = `${line} L${W},${z.toFixed(1)} L0,${z.toFixed(1)} Z`
  const last = data[data.length - 1]
  const col = last >= 0 ? GREEN : RED
  const LEN = 2600

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: H, width: '100%' }}>
      <line x1="0" y1={z} x2={W} y2={z} stroke="#21385a" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <path d={area} fill={last >= 0 ? 'rgba(46,230,166,0.10)' : 'rgba(248,113,113,0.10)'} style={{ opacity: m ? 1 : 0, transition: 'opacity .8s ease .5s' }} />
      <path
        d={line}
        fill="none"
        stroke={col}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        style={{ strokeDasharray: LEN, strokeDashoffset: m ? 0 : LEN, transition: 'stroke-dashoffset 1.3s ease' }}
      />
    </svg>
  )
}

export function Donut({ wins, losses }: { wins: number; losses: number }) {
  const m = useMounted()
  const total = wins + losses
  const wr = total ? wins / total : 0
  const C = 2 * Math.PI * 52
  return (
    <svg viewBox="0 0 160 160" style={{ height: 150, width: 150, display: 'block', margin: '0 auto' }}>
      <circle cx="80" cy="80" r="52" fill="none" stroke="#0e2747" strokeWidth="16" />
      <circle cx="80" cy="80" r="52" fill="none" stroke={GREEN} strokeWidth="16" transform="rotate(-90 80 80)" strokeDasharray={`${m ? wr * C : 0} ${C}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
      <circle cx="80" cy="80" r="52" fill="none" stroke={RED} strokeWidth="16" transform={`rotate(${-90 + wr * 360} 80 80)`} strokeDasharray={`${m ? (1 - wr) * C : 0} ${C}`} style={{ transition: 'stroke-dasharray 1s ease .15s' }} />
      <text x="80" y="76" textAnchor="middle" fill="#eef3fa" style={{ font: '600 26px JetBrains Mono' }}>{(wr * 100).toFixed(1)}%</text>
      <text x="80" y="96" textAnchor="middle" fill="#5e7089" style={{ font: '10px Archivo', letterSpacing: '.12em' }}>WIN RATE</text>
    </svg>
  )
}

export function HBars({ items }: { items: { label: string; value: number }[] }) {
  const m = useMounted()
  if (!items.length) return <div className="center-msg" style={{ height: 60 }}>No data</div>
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1)
  return (
    <div className="hbars">
      {items.map((it, k) => (
        <div className="hbar" key={k}>
          <span className="lbl">{it.label}</span>
          <div className="track">
            <div className="fill" style={{ width: m ? `${(Math.abs(it.value) / max) * 100}%` : '0%', background: it.value >= 0 ? GREEN : RED }} />
          </div>
          <span className={it.value >= 0 ? 'up' : 'down'}>{(it.value >= 0 ? '+' : '−') + formatCompactUsd(Math.abs(it.value))}</span>
        </div>
      ))}
    </div>
  )
}

export function DistBars({ values }: { values: number[] }) {
  const m = useMounted()
  if (!values.length) return <div className="center-msg" style={{ height: 70 }}>No closed trades</div>
  const max = Math.max(...values.map(Math.abs), 1)
  return (
    <div className="dist">
      {values.map((v, k) => (
        <div
          key={k}
          className="distcol"
          style={{ height: `${(Math.abs(v) / max) * 100}%`, background: v >= 0 ? GREEN : RED, transform: m ? 'scaleY(1)' : 'scaleY(0)', transitionDelay: `${k * 0.015}s` }}
        />
      ))}
    </div>
  )
}
