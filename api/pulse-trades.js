// api/pulse-trades.js — a wallet's transfers of ONE token on PulseChain, via g4mm4 RPC.
//
// eth_getLogs for the ERC-20 Transfer events where the wallet is sender or receiver.
// Block timestamps are ESTIMATED from block number via a linear fit (two reference
// blocks) — O(1) per log instead of one RPC per block, which is what was timing the
// function out on high-activity tokens like WPLS. Timestamps only need to be
// approximate (markers are priced at the candle close anyway). Output matches the
// Blockscout shape so the client mapper (walletTrades.ts) consumes it unchanged.

export const config = { maxDuration: 60 }

const RPC = 'https://rpc-pulsechain.g4mm4.io'
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const DECIMALS = '0x313ce567'
const MAX_TRANSFERS = 1500 // keep the chart readable + the response bounded

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

// Linear block→unix-seconds estimate from two real reference blocks.
async function blockClock() {
  const [latest, early] = await Promise.all([
    rpc('eth_getBlockByNumber', ['latest', false]),
    rpc('eth_getBlockByNumber', ['0xf4240', false]), // block 1,000,000
  ])
  const ln = parseInt(latest.number, 16)
  const lt = parseInt(latest.timestamp, 16)
  const en = parseInt(early.number, 16)
  const et = parseInt(early.timestamp, 16)
  const rate = ln > en ? (lt - et) / (ln - en) : 10 // seconds per block
  return (bn) => Math.round(et + (bn - en) * rate)
}

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
    const [decHex, sent, recv, clock] = await Promise.all([
      rpc('eth_call', [{ to: token, data: DECIMALS }, 'latest']).catch(() => '0x12'),
      rpc('eth_getLogs', [{ ...base, topics: [TRANSFER, w] }]), // from = wallet
      rpc('eth_getLogs', [{ ...base, topics: [TRANSFER, null, w] }]), // to = wallet
      blockClock(),
    ])
    const decimals = String(parseInt(decHex, 16) || 18)

    let logs = [...(sent || []), ...(recv || [])].filter((l) => l.topics && l.topics.length >= 3)
    // most-recent-first, cap, then back to chronological
    logs.sort((a, b) => parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16))
    if (logs.length > MAX_TRANSFERS) logs = logs.slice(0, MAX_TRANSFERS)

    const transfers = logs
      .map((l) => {
        const bn = parseInt(l.blockNumber, 16)
        return {
          timestamp: new Date(clock(bn) * 1000).toISOString(),
          transaction_hash: l.transactionHash,
          from: { hash: topicToAddr(l.topics[1]) },
          to: { hash: topicToAddr(l.topics[2]) },
          total: { value: BigInt(l.data || '0x0').toString(), decimals },
          _b: bn,
          _i: parseInt(l.logIndex, 16),
        }
      })
      .sort((a, b) => a._b - b._b || a._i - b._i)

    res.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=120')
    res.status(200).json({ transfers })
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || 'rpc trades failed') })
  }
}
