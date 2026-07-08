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
export const IconCandles = ({ size }: P) => (
  <svg {...base(size)}><rect x="6" y="7" width="3.5" height="10" rx="1" /><path d="M7.7 3v4M7.7 17v4" /><rect x="14.5" y="9" width="3.5" height="7" rx="1" /><path d="M16.2 5v4M16.2 16v3" /></svg>
)
export const IconLineChart = ({ size }: P) => (
  <svg {...base(size)}><path d="M3 16l5-6 4 3 6-8 3 4" /></svg>
)
export const IconFullscreen = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
)
export const IconCamera = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
)
export const IconChevron = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 9l6 6 6-6" /></svg>
)
export const IconCursor = ({ size }: P) => (
  <svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l15 9-6 1.5L11 20z" /></svg>
)
export const IconTrendline = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 20L20 4" /><rect x="2" y="18" width="4" height="4" rx="1" fill="currentColor" /><rect x="18" y="2" width="4" height="4" rx="1" fill="currentColor" /></svg>
)
export const IconHLine = ({ size }: P) => (
  <svg {...base(size)}><path d="M3 12h18" /></svg>
)
export const IconRay = ({ size }: P) => (
  <svg {...base(size)}><path d="M3 18L21 6M21 6h-5M21 6v5" /></svg>
)
export const IconRect = ({ size }: P) => (
  <svg {...base(size)}><rect x="4" y="6" width="16" height="12" rx="1" /></svg>
)
export const IconTrash = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
)
export const IconXSocial = ({ size }: P) => (
  <svg width={size ?? 14} height={size ?? 14} viewBox="0 0 24 24" fill="currentColor"><path d="M17.7 3H21l-7.2 8.3L22.3 21h-6.6l-5.2-6.1L4.6 21H1.3l7.7-8.9L1.7 3h6.8l4.7 5.5L17.7 3zm-1.2 16h1.8L7.1 4.9H5.2L16.5 19z" /></svg>
)
export const IconTelegram = ({ size }: P) => (
  <svg width={size ?? 14} height={size ?? 14} viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.6 18.9 19c-.2 1-.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-.9.5l.3-4.7L18.4 6c.4-.3-.1-.5-.6-.2L7.3 12.4l-4.5-1.4c-1-.3-1-1 .2-1.4l17.6-6.8c.8-.3 1.5.2 1.3 1.8z" /></svg>
)
