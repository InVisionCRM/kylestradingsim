// api/pulse-trades.js — a wallet's transfers of ONE token on PulseChain, via g4mm4 RPC.
//
// eth_getLogs for the ERC-20 Transfer events where the wallet is sender or receiver,
// then resolve block timestamps. Returns the same shape the Blockscout path returns,
// so the existing client mapper (walletTrades.ts) consumes it unchanged.

const RPC = 'https://rpc-pulsechain.g4mm4.io'
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const DECIMALS = '0x313ce567'

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const j = await r.json()
  if (j.error) throw new Error(j.error.message || 'rpc error')
  return j.result
}

const asTopic = (addr) => '0x' + addr.slice(2).padStart(64, '0')
const topicToAddr = (t) => '0x' + t.slice(26)

export default async function handler(req, res) {
  const wallet = String(req.query.wallet || '').toLowerCase()
  const token = String(req.query.token || '').toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(wallet) || !/^0x[0-9a-f]{40}$/.test(token)) {
    res.status(400).json({ error: 'bad ?wallet or ?token' })
    return
  }

  try {
    const w = asTopic(wallet)
    const base = { address: token, fromBlock: '0x0', toBlock: 'latest' }
    const [decHex, sent, recv] = await Promise.all([
      rpc('eth_call', [{ to: token, data: DECIMALS }, 'latest']).catch(() => '0x12'), // default 18
      rpc('eth_getLogs', [{ ...base, topics: [TRANSFER, w] }]), // from = wallet
      rpc('eth_getLogs', [{ ...base, topics: [TRANSFER, null, w] }]), // to = wallet
    ])
    const decimals = String(parseInt(decHex, 16) || 18)
    const logs = [...(sent || []), ...(recv || [])]

    // resolve block timestamps in batches
    const blocks = [...new Set(logs.map((l) => l.blockNumber))]
    const ts = {}
    for (let i = 0; i < blocks.length; i += 50) {
      const chunk = blocks.slice(i, i + 50)
      const batch = chunk.map((bn, j) => ({
        jsonrpc: '2.0',
        id: j,
        method: 'eth_getBlockByNumber',
        params: [bn, false],
      }))
      const r = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(batch),
      })
      const arr = await r.json()
      if (Array.isArray(arr))
        for (const item of arr) {
          const bn = chunk[item.id]
          if (item.result?.timestamp) ts[bn] = parseInt(item.result.timestamp, 16)
        }
    }

    const transfers = logs
      .filter((l) => l.topics && l.topics.length >= 3)
      .map((l) => ({
        timestamp: ts[l.blockNumber] ? new Date(ts[l.blockNumber] * 1000).toISOString() : null,
        transaction_hash: l.transactionHash,
        from: { hash: topicToAddr(l.topics[1]) },
        to: { hash: topicToAddr(l.topics[2]) },
        total: { value: BigInt(l.data || '0x0').toString(), decimals },
        _b: parseInt(l.blockNumber, 16),
        _i: parseInt(l.logIndex, 16),
      }))
      .filter((t) => t.timestamp)
      .sort((a, b) => a._b - b._b || a._i - b._i)

    res.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=120')
    res.status(200).json({ transfers })
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || 'rpc trades failed') })
  }
}
