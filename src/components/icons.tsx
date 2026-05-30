interface P { size?: number }
const base = (size = 16) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const IconSearch = ({ size }: P) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
)
export const IconGear = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 005 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 13H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 5l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0011 3.6V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0021 11h.1a2 2 0 110 4H21a1.6 1.6 0 00-1.6 1z" /></svg>
)
export const IconX = ({ size }: P) => (
  <svg {...base(size)}><path d="M18 6L6 18M6 6l12 12" /></svg>
)
export const IconPlay = ({ size }: P) => (
  <svg width={size ?? 14} height={size ?? 14} viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
)
export const IconPause = ({ size }: P) => (
  <svg width={size ?? 14} height={size ?? 14} viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
)
export const IconStepBack = ({ size }: P) => (
  <svg width={size ?? 14} height={size ?? 14} viewBox="0 0 24 24" fill="currentColor"><path d="M11 5L4 12l7 7zM20 5l-7 7 7 7z" /></svg>
)
export const IconStepFwd = ({ size }: P) => (
  <svg width={size ?? 14} height={size ?? 14} viewBox="0 0 24 24" fill="currentColor"><path d="M13 5l7 7-7 7zM4 5l7 7-7 7z" /></svg>
)
export const IconGlobe = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>
)
export const IconLink = ({ size }: P) => (
  <svg {...base(size)}><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1" /><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" /></svg>
)
