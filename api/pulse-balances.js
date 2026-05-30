// api/pulse-balances.js — PulseChain ERC-20 holdings via the keyless g4mm4 RPC.
//
// PulseChain's Blockscout is blocked, so we can't ask "what does this wallet hold?".
// Instead we check the wallet's balanceOf across a curated PulseChain token universe
// (PulseX token lists + guaranteed core tokens) and return the non-zero ones.

const RPC = 'https://rpc-pulsechain.g4mm4.io'
const LISTS = [
  'https://tokens.app.pulsex.com/pulsex.tokenlist.json',
  'https://tokens.app.pulsex.com/pulsex-extended.tokenlist.json',
]
// guaranteed floor so the heavyweight tokens always appear even if a list is down
const CORE = [
  { address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', symbol: 'WPLS', name: 'Wrapped Pulse', decimals: 18 },
  { address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab', symbol: 'PLSX', name: 'PulseX', decimals: 18 },
  { address: '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', symbol: 'INC', name: 'Incentive', decimals: 18 },
  { address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', symbol: 'HEX', name: 'HEX', decimals: 8 },
  { address: '0x3819f64f282bf135d62168c1e513280daf905e06', symbol: 'HDRN', name: 'Hedron', decimals: 9 },
]
const BALANCE_OF = '0x70a08231'
const logo = (a) => `https://tokens.app.pulsex.com/images/tokens/${a}.png`

async function tokenUniverse() {
  const lists = await Promise.all(
    LISTS.map((u) =>
      fetch(u)
        .then((r) => (r.ok ? r.json() : { tokens: [] }))
        .catch(() => ({ tokens: [] })),
    ),
  )
  const map = new Map()
  for (const t of CORE) map.set(t.address, { ...t, logoURI: logo(t.address) })
  for (const l of lists)
    for (const t of l.tokens || []) {
      if (t.chainId !== 369) continue
      const a = String(t.address || '').toLowerCase()
      if (!a || map.has(a)) continue
      map.set(a, { address: a, symbol: t.symbol, name: t.name, decimals: t.decimals, logoURI: t.logoURI || logo(a) })
    }
  return [...map.values()]
}

async function batchCall(calls) {
  const out = {}
  for (let i = 0; i < calls.length; i += 100) {
    const chunk = calls.slice(i, i + 100)
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(chunk),
    })
    const arr = await r.json()
    for (const item of Array.isArray(arr) ? arr : []) out[item.id] = item.result
  }
  return out
}

export default async function handler(req, res) {
  const wallet = String(req.query.wallet || '').toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
    res.status(400).json({ error: 'bad or missing ?wallet' })
    return
  }
  try {
    const tokens = await tokenUniverse()
    const data = BALANCE_OF + wallet.slice(2).padStart(64, '0')
    const calls = tokens.map((t, i) => ({
      jsonrpc: '2.0',
      id: i,
      method: 'eth_call',
      params: [{ to: t.address, data }, 'latest'],
    }))
    const results = await batchCall(calls)

    const holdings = []
    tokens.forEach((t, i) => {
      const hex = results[i]
      if (!hex || hex === '0x') return
      let raw
      try {
        raw = BigInt(hex)
      } catch {
        return
      }
      if (raw === 0n) return
      const balance = Number(raw) / 10 ** t.decimals
      if (!(balance > 0)) return
      holdings.push({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        iconUrl: t.logoURI,
        balance,
        priceUsd: null,
        valueUsd: null,
      })
    })

    res.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=120')
    res.status(200).json({ holdings, scanned: tokens.length })
  } catch {
    res.status(502).json({ error: 'rpc balances failed' })
  }
}
