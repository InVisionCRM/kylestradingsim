const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']
function sub(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUB[+d])
    .join('')
}

/**
 * Adaptive price formatting for everything from $2.41 to $0.0₄2413 (memecoins).
 * Sub-penny values use DexScreener-style leading-zero compaction.
 */
export function formatPrice(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—'
  if (v === 0) return '0'
  if (v < 0) return '-' + formatPrice(-v)
  if (v >= 1) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  if (v >= 0.01) return v.toFixed(4)
  const decimals = v.toFixed(20).split('.')[1] ?? ''
  let z = 0
  while (decimals[z] === '0') z++
  const sig = (decimals.slice(z, z + 4).replace(/0+$/, '') || '0')
  return z >= 4 ? `0.0${sub(z)}${sig}` : `0.${'0'.repeat(z)}${sig}`
}

/** Price with a leading $ — used in headers/axes. */
export function formatPriceUsd(v: number | null | undefined): string {
  const p = formatPrice(v)
  return p === '—' ? '—' : '$' + p
}

/** Dollar amount with cents — balances, P&L, trade values. */
export function formatUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—'
  return v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Compact dollars — liquidity, FDV, market cap, volume. */
export function formatCompactUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M'
  if (a >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K'
  return '$' + v.toFixed(2)
}

/** Signed percentage. */
export function formatPct(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—'
  const sign = v >= 0 ? '+' : '−'
  return sign + Math.abs(v).toFixed(2) + '%'
}

/** Compact token quantity — handles billions of memecoin units. */
export function formatQty(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (a >= 1e3) return (v / 1e3).toFixed(2) + 'K'
  if (a >= 1) return v.toFixed(2)
  if (a === 0) return '0'
  return v.toPrecision(4)
}

export function signClass(v: number | null | undefined): 'up' | 'down' | '' {
  if (v == null || !isFinite(v) || v === 0) return ''
  return v > 0 ? 'up' : 'down'
}
