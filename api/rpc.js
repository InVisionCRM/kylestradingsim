// Vercel serverless function — keyless JSON-RPC proxy.
//
// PulseChain's Blockscout blocks server + browser access, so for PulseChain we read
// chain data straight from a node (g4mm4's RPC) instead of an explorer. The browser
// calls this same-origin (no CORS); we POST to the node server-side.
//
// POST: forward the JSON-RPC body as-is (single call or batch array).
// GET:  ?chain=pulsechain&method=eth_blockNumber&params=[]  (single call — used for testing)

const RPC = {
  pulsechain: 'https://rpc-pulsechain.g4mm4.io',
  ethereum: 'https://eth.llamarpc.com',
}

export default async function handler(req, res) {
  const chain = req.query.chain
  const url = RPC[chain]
  if (!url) {
    res.status(400).json({ error: 'bad or missing ?chain (pulsechain|ethereum)' })
    return
  }

  let payload
  if (req.method === 'POST') {
    payload = req.body
  } else {
    const method = req.query.method
    if (!method) {
      res.status(400).json({ error: 'GET requires ?method=' })
      return
    }
    let params = []
    try {
      params = req.query.params ? JSON.parse(req.query.params) : []
    } catch {
      params = []
    }
    payload = { jsonrpc: '2.0', id: 1, method, params }
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await upstream.text()
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.status(upstream.status).send(body)
  } catch {
    res.status(502).json({ error: 'rpc node unreachable' })
  }
}
