import { registerIndicator, IndicatorSeries, type KLineData } from 'klinecharts'

let registered = false

/** Register indicators KLineChart doesn't ship with. Idempotent. */
export function registerCustomIndicators(): void {
  if (registered) return
  registered = true

  // VWAP — cumulative volume-weighted average price, overlaid on the price pane.
  registerIndicator<{ vwap?: number }>({
    name: 'VWAP',
    shortName: 'VWAP',
    series: IndicatorSeries.Price,
    precision: 8,
    figures: [{ key: 'vwap', title: 'VWAP: ', type: 'line' }],
    calc: (dataList: KLineData[]) => {
      let pv = 0
      let vv = 0
      return dataList.map((k) => {
        const vol = k.volume ?? 0
        const typical = (k.high + k.low + k.close) / 3
        pv += typical * vol
        vv += vol
        return { vwap: vv > 0 ? pv / vv : undefined }
      })
    },
  })
}
