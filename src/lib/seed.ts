/** Default tokens resolved on first launch so the app is never empty. */
export const SEED_TOKENS: { symbol: string; chainId: string }[] = [
  { symbol: 'SOL', chainId: 'solana' },
  { symbol: 'WIF', chainId: 'solana' },
  { symbol: 'BONK', chainId: 'solana' },
  { symbol: 'POPCAT', chainId: 'solana' },
  { symbol: 'JUP', chainId: 'solana' },
  { symbol: 'PEPE', chainId: 'ethereum' },
]

/** The token shown on a fresh load. */
export const DEFAULT_TOKEN = SEED_TOKENS[1] // WIF
