// Vercel serverless function — server-side Blockscout proxy.
//
// PulseChain's Blockscout (api.scan.pulsechain.com) sits behind Cloudflare and
// blocks direct cross-origin browser calls, so fetching it from the browser fails.
// Fetching it server-side (the way the portfolio's /api/portfolio routes do) gets
// through. One path for both chains.
//
// Client calls: /api/blockscout?chain=pulsechain&path=<url-encoded /addresses/0x..//tokens?type=ERC-20>

const BASE = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
}

export default async function handler(req, res) {
  const chain = req.query.chain
  const path = req.query.path
  const base = BASE[chain]

  if (!base || typeof path !== 'string' || !path.startsWith('/')) {
    res.status(400).json({ error: 'bad request — expected ?chain=pulsechain|ethereum&path=/...' })
    return
  }

  try {
    const upstream = await fetch(`${base}${path}`, {
      headers: {
        accept: 'application/json',
        // a real browser UA helps pass Cloudflare's bot checks
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    })
    const body = await upstream.text()
    res.setHeader('content-type', 'application/json; charset=utf-8')
    // brief edge cache so repeated holdings/transfer calls are cheap
    res.setHeader('cache-control', 's-maxage=15, stale-while-revalidate=60')
    res.status(upstream.status).send(body)
  } catch {
    res.status(502).json({ error: 'upstream explorer unreachable' })
  }
}
