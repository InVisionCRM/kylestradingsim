// DexScreener `chainId` values map to different GeckoTerminal `network` slugs.
// This is the bridge between the two APIs. Verify/extend against GeckoTerminal's
// GET /networks endpoint if you add chains.
export const CHAIN_TO_GECKO: Record<string, string> = {
  solana: 'solana',
  ethereum: 'eth',
  bsc: 'bsc',
  base: 'base',
  arbitrum: 'arbitrum',
  polygon: 'polygon_pos',
  avalanche: 'avax',
  optimism: 'optimism',
  pulsechain: 'pulsechain',
  blast: 'blast',
  linea: 'linea',
  scroll: 'scroll',
  fantom: 'ftm',
  cronos: 'cro',
  zksync: 'zksync',
  mantle: 'mantle',
  sui: 'sui-network',
  ton: 'ton',
  tron: 'tron',
  sei: 'sei-evm',
  celo: 'celo',
  berachain: 'berachain',
  unichain: 'unichain',
  hyperliquid: 'hyperliquid',
  aptos: 'aptos',
}

export function toGeckoNetwork(chainId: string): string | null {
  return CHAIN_TO_GECKO[chainId] ?? null
}
