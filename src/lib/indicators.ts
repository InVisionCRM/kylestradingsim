/** Indicator math. Each returns an array aligned to the input (null during warmup). */

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length < period) return out
  const k = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  let prev = sum / period
  out[period - 1] = prev
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export interface Bands {
  upper: (number | null)[]
  middle: (number | null)[]
  lower: (number | null)[]
}

export function bollinger(values: number[], period = 20, mult = 2): Bands {
  const middle = sma(values, period)
  const upper: (number | null)[] = new Array(values.length).fill(null)
  const lower: (number | null)[] = new Array(values.length).fill(null)
  for (let i = 0; i < values.length; i++) {
    const m = middle[i]
    if (m == null) continue
    let sq = 0
    for (let j = i - period + 1; j <= i; j++) sq += (values[j] - m) ** 2
    const sd = Math.sqrt(sq / period)
    upper[i] = m + mult * sd
    lower[i] = m - mult * sd
  }
  return { upper, middle, lower }
}

/** Cumulative VWAP over the loaded window (typical price weighted by volume). */
export function vwap(candles: { high: number; low: number; close: number; volume: number }[]): (number | null)[] {
  let pv = 0
  let vv = 0
  return candles.map((c) => {
    const tp = (c.high + c.low + c.close) / 3
    pv += tp * c.volume
    vv += c.volume
    return vv > 0 ? pv / vv : null
  })
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1]
    if (ch >= 0) gain += ch
    else loss -= ch
  }
  let avgG = gain / period
  let avgL = loss / period
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL)
  for (let i = period + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1]
    const g = ch >= 0 ? ch : 0
    const l = ch < 0 ? -ch : 0
    avgG = (avgG * (period - 1) + g) / period
    avgL = (avgL * (period - 1) + l) / period
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL)
  }
  return out
}
