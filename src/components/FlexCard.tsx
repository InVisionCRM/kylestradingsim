import { useEffect, useRef, useState } from 'react'
import { useUi } from '../state/useUi'
import { formatPrice, formatUsd } from '../lib/format'
import { colorFor } from './TokenIcon'
import type { FlexInfo } from '../state/useUi'

const W = 1080
const H = 1350

interface Theme {
  bg1: string
  bg2: string
  glow: string
  grid: string
}
const THEMES: Theme[] = [
  { bg1: '#0e2747', bg2: '#0a1020', glow: 'rgba(99,102,241,0.34)', grid: 'rgba(255,255,255,0.05)' },
  { bg1: '#0c3f2c', bg2: '#04120c', glow: 'rgba(46,230,166,0.30)', grid: 'rgba(46,230,166,0.07)' },
  { bg1: '#3b1a6e', bg2: '#120826', glow: 'rgba(216,132,252,0.32)', grid: 'rgba(216,132,252,0.08)' },
]

/** Deterministic sparkline shaped by the symbol, rising for wins and falling for losses. */
function sparkSeries(symbol: string, win: boolean): number[] {
  let seed = 9
  for (let i = 0; i < symbol.length; i++) seed = Math.imul(seed ^ symbol.charCodeAt(i), 387420489) >>> 0
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const out: number[] = []
  let v = 100
  for (let i = 0; i < 42; i++) {
    v *= 1 + 0.012 + (rand() - 0.5) * 0.06
    out.push(v)
  }
  return win ? out : out.slice().reverse()
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawCard(ctx: CanvasRenderingContext2D, d: FlexInfo, theme: Theme): void {
  const win = d.roiPct >= 0
  const roiCol = win ? '#2ee6a6' : '#f87171'

  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, theme.bg1)
  g.addColorStop(0.55, theme.bg2)
  g.addColorStop(1, theme.bg2)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = theme.grid
  ctx.lineWidth = 1
  for (let gx = 0; gx <= W; gx += 90) {
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, H)
    ctx.stroke()
  }
  for (let gy = 0; gy <= H; gy += 90) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(W, gy)
    ctx.stroke()
  }

  const rg = ctx.createRadialGradient(W / 2, 610, 60, W / 2, 610, 620)
  rg.addColorStop(0, theme.glow)
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, W, H)

  // brand header
  ctx.fillStyle = '#6366f1'
  roundedRect(ctx, 72, 72, 44, 44, 10)
  ctx.fill()
  ctx.fillStyle = '#eef3fa'
  ctx.textAlign = 'left'
  ctx.font = '800 40px system-ui, sans-serif'
  ctx.fillText('P A P E R D E X', 140, 106)
  ctx.font = '700 24px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(238,243,250,0.45)'
  ctx.textAlign = 'right'
  ctx.fillText('PAPER P&L', W - 72, 104)

  // token row
  ctx.fillStyle = colorFor(d.symbol || '?')
  ctx.beginPath()
  ctx.arc(104, 262, 32, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0a1020'
  ctx.font = '800 24px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText((d.symbol || '?').slice(0, 1).toUpperCase(), 104, 272)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#eef3fa'
  ctx.font = '800 56px system-ui, sans-serif'
  ctx.fillText(d.symbol, 160, 282)
  const sw = ctx.measureText(d.symbol).width
  ctx.fillStyle = win ? 'rgba(46,230,166,0.16)' : 'rgba(248,113,113,0.16)'
  roundedRect(ctx, 160 + sw + 24, 234, 118, 52, 10)
  ctx.fill()
  ctx.fillStyle = roiCol
  ctx.font = '800 28px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('LONG', 160 + sw + 24 + 59, 270)
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(238,243,250,0.4)'
  ctx.font = '600 26px system-ui, sans-serif'
  ctx.fillText(d.closed ? 'CLOSED TRADE' : 'OPEN POSITION', 160, 330)

  // giant ROI
  const roiTxt = `${win ? '+' : '−'}${Math.abs(d.roiPct).toFixed(1)}%`
  ctx.save()
  ctx.shadowColor = roiCol
  ctx.shadowBlur = 70
  ctx.fillStyle = roiCol
  ctx.textAlign = 'center'
  ctx.font = `900 ${Math.abs(d.roiPct) >= 100 ? 200 : 230}px system-ui, sans-serif`
  ctx.fillText(roiTxt, W / 2, 700)
  ctx.restore()
  ctx.fillStyle = 'rgba(238,243,250,0.65)'
  ctx.font = '600 34px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${d.closed ? 'Realized' : 'Unrealized'} P&L  ${formatUsd(d.pnlUsd)}`, W / 2, 775)

  // entry / mark
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(238,243,250,0.4)'
  ctx.font = '700 22px system-ui, sans-serif'
  ctx.fillText('ENTRY', 120, 880)
  ctx.fillText(d.closed ? 'EXIT' : 'MARK', 620, 880)
  ctx.fillStyle = '#eef3fa'
  ctx.font = '600 46px ui-monospace, Menlo, monospace'
  ctx.fillText(formatPrice(d.entryUsd), 120, 936)
  ctx.fillText(formatPrice(d.markUsd), 620, 936)

  // sparkline
  const cs = sparkSeries(d.symbol, win)
  let min = Infinity
  let max = -Infinity
  for (const v of cs) {
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  const sx = (i: number) => 96 + ((W - 192) * i) / (cs.length - 1)
  const sy = (p: number) => 1180 - (170 * (p - min)) / (max - min || 1)
  const ag = ctx.createLinearGradient(0, 1010, 0, 1190)
  ag.addColorStop(0, win ? 'rgba(46,230,166,0.30)' : 'rgba(248,113,113,0.30)')
  ag.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.moveTo(sx(0), 1185)
  cs.forEach((v, i) => ctx.lineTo(sx(i), sy(v)))
  ctx.lineTo(sx(cs.length - 1), 1185)
  ctx.closePath()
  ctx.fillStyle = ag
  ctx.fill()
  ctx.beginPath()
  cs.forEach((v, i) => (i === 0 ? ctx.moveTo(sx(i), sy(v)) : ctx.lineTo(sx(i), sy(v))))
  ctx.strokeStyle = roiCol
  ctx.lineWidth = 5
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(sx(cs.length - 1), sy(cs[cs.length - 1]), 10, 0, Math.PI * 2)
  ctx.fillStyle = roiCol
  ctx.fill()

  // footer
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.beginPath()
  ctx.moveTo(72, 1246)
  ctx.lineTo(W - 72, 1246)
  ctx.stroke()
  ctx.fillStyle = 'rgba(238,243,250,0.45)'
  ctx.font = '600 26px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(
    new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
    72,
    1298,
  )
  ctx.textAlign = 'right'
  ctx.fillText('Paper trading. Real skills.', W - 72, 1298)
}

/**
 * Full-screen overlay that renders a shareable 1080×1350 P&L card ("flex card")
 * for a position or closed trade, with native share + PNG download.
 */
export function FlexCard() {
  const flex = useUi((s) => s.flex)
  const [theme, setTheme] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!flex) return
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawCard(ctx, flex, THEMES[theme])
  }, [flex, theme])

  useEffect(() => {
    if (!note) return
    const id = setTimeout(() => setNote(null), 2200)
    return () => clearTimeout(id)
  }, [note])

  if (!flex) return null

  const toBlob = (cb: (b: Blob | null) => void) => canvasRef.current?.toBlob(cb, 'image/png')
  const download = (blob: Blob) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `paperdex-${flex.symbol.toLowerCase()}-pnl.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    setNote('Card saved — post it anywhere')
  }
  const share = () => {
    toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `paperdex-${flex.symbol.toLowerCase()}-pnl.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file], title: 'PAPERDEX P&L' }).catch(() => {})
      } else {
        download(blob)
      }
    })
  }

  return (
    <div className="shareov">
      <div className="shhead">
        <span className="t">Flex your P&amp;L</span>
        <button className="shx" aria-label="Close" onClick={() => useUi.getState().closeFlex()}>
          ×
        </button>
      </div>
      <div className="cardwrap">
        <canvas ref={canvasRef} className="flexcard" width={W} height={H} />
      </div>
      <div className="themedots">
        {THEMES.map((_, i) => (
          <button
            key={i}
            className={`d${i + 1} ${theme === i ? 'on' : ''}`}
            aria-label={`Card theme ${i + 1}`}
            onClick={() => setTheme(i)}
          />
        ))}
      </div>
      <div className="shactions">
        <button className="primary" onClick={share}>
          SHARE
        </button>
        <button className="ghost" onClick={() => toBlob((b) => b && download(b))}>
          SAVE IMAGE
        </button>
      </div>
      <div className="shnote">{note ?? 'Shares through your phone’s share sheet — X, Telegram, wherever.'}</div>
    </div>
  )
}
