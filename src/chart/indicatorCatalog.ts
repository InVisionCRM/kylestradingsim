export interface IndicatorDef {
  name: string // KLineChart indicator name (or our custom 'VWAP')
  label: string
  overlay: boolean // true = drawn on the price pane, false = its own sub-pane
}

/** KLineChart's built-in indicators (+ our custom VWAP). overlay = price-pane vs sub-pane. */
export const INDICATORS: IndicatorDef[] = [
  // Price-pane overlays
  { name: 'MA', label: 'MA (SMA)', overlay: true },
  { name: 'EMA', label: 'EMA', overlay: true },
  { name: 'BOLL', label: 'Bollinger Bands', overlay: true },
  { name: 'SAR', label: 'Parabolic SAR', overlay: true },
  { name: 'BBI', label: 'BBI', overlay: true },
  { name: 'VWAP', label: 'VWAP', overlay: true },
  // Oscillators & volume (sub-panes)
  { name: 'VOL', label: 'Volume', overlay: false },
  { name: 'MACD', label: 'MACD', overlay: false },
  { name: 'KDJ', label: 'Stochastic (KDJ)', overlay: false },
  { name: 'RSI', label: 'RSI', overlay: false },
  { name: 'WR', label: 'Williams %R', overlay: false },
  { name: 'CCI', label: 'CCI', overlay: false },
  { name: 'DMI', label: 'DMI / ADX', overlay: false },
  { name: 'TRIX', label: 'TRIX', overlay: false },
  { name: 'OBV', label: 'OBV', overlay: false },
  { name: 'BIAS', label: 'BIAS', overlay: false },
  { name: 'BRAR', label: 'BRAR', overlay: false },
  { name: 'CR', label: 'CR', overlay: false },
  { name: 'PSY', label: 'PSY', overlay: false },
  { name: 'DMA', label: 'DMA', overlay: false },
  { name: 'VR', label: 'VR', overlay: false },
  { name: 'MTM', label: 'MTM', overlay: false },
  { name: 'EMV', label: 'EMV', overlay: false },
  { name: 'ROC', label: 'ROC', overlay: false },
  { name: 'PVT', label: 'PVT', overlay: false },
  { name: 'AO', label: 'Awesome Oscillator', overlay: false },
]

export function isOverlayIndicator(name: string): boolean {
  return INDICATORS.find((i) => i.name === name)?.overlay ?? false
}
