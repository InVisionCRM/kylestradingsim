# PAPERDEX

A TradingView-style **DEX trading simulator**. Practice trading real on-chain tokens with fake money — in two modes: **live paper trading** against real-time prices and **historical replay** (bar-by-bar playback). Everything runs in your browser; nothing is saved to a server and no real funds are ever involved.

- **Charts** — TradingView Lightweight Charts v5 (candles, volume, trade markers, average-entry line)
- **Candles** — GeckoTerminal OHLCV API (keyless)
- **Token data / logos / live price** — DexScreener API (keyless)
- **Theme** — "Carbon Brutalist": dark, structural, one electric-yellow accent (Archivo + JetBrains Mono)

---

## Quick start

You need [Node.js](https://nodejs.org) 18+ installed. Then:

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173). That's it — the app loads WIF on Solana by default and seeds a watchlist.

Other commands:

```bash
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build locally
npm test          # run the engine + formatter unit tests
```

---

## What it does

**Live paper trading** — Buy/sell the active token at its real-time price (polled every ~5s from DexScreener). Track holdings, average entry, market value, realized + unrealized P&L, and total equity. Order by USD or token amount with 25/50/75/Max quick-sizing and a configurable fee.

**Historical replay** — Switch to Replay mode to reveal candles bar-by-bar. Play/pause, step, scrub, and change speed (0.5×–10×). Trades fill at the replayed bar's price. Replay uses a **separate account** so practice never mixes with your live sim.

**Discovery** — Search any token (or paste an address), keep a watchlist with live prices, and browse a DexScreener-powered trending list.

**Persistence** — Your accounts, positions, trades, watchlist, active token, and mode are saved in the browser (localStorage). The reset button restores an account's starting balance.

---

## How it's wired

```
src/
  api/         client.ts (base URLs + GeckoTerminal throttle), chains.ts (chain-id map),
               geckoterminal.ts (OHLCV), dexscreener.ts (search / pair / token / trending)
  sim/         engine.ts (pure buy/sell/P&L), errors.ts  — covered by engine.test.ts
  state/       useSim (persisted accounts), useMarket, useWatchlist, useReplay, useMarketData
  hooks/       useBootstrap, useDataLoaders (candles / live price / replay clock), useDerived
  chart/       Chart.tsx (Lightweight Charts v5 wrapper)
  components/  TopBar, TokenSearch, LeftPanel, ChartPanel, ReplayControls,
               OrderPanel, RightPanel, Blotter, TokenIcon, icons
  lib/         format.ts (memecoin-aware number formatting), seed.ts
  styles.css   Carbon Brutalist design tokens + all component styles
```

Key design choices: the trade engine is **pure and unit-tested**; data adapters **normalize** API responses so components never touch raw JSON; GeckoTerminal calls are **throttled** (≥1.2s apart) to respect its ~30 req/min limit; in dev a **Vite proxy** sidesteps CORS, and in production the app calls both public APIs directly.

### Note on data
GeckoTerminal's public API allows ~30 requests/minute. The app caches candles and throttles requests, but if you switch tokens/timeframes very rapidly you may briefly see a rate-limit message — it recovers on its own. DexScreener is more generous (300 req/min).

Charts are only available on chains GeckoTerminal indexes; the chain-id map lives in `src/api/chains.ts` (extend it against GeckoTerminal's `GET /networks` if you add chains).

---

## Customizing

- **Theme** — edit the `:root` tokens at the top of `src/styles.css`. Swapping the palette/fonts is a one-block change (e.g. to a light "Paper Ledger" or neon "Degen" look).
- **Starting balance** — `STARTING_BALANCE` in `src/state/useSim.ts`.
- **Fee** — `settings.feeBps` in `src/state/useSim.ts` (default 30 bps = 0.30%).
- **Default token + watchlist seed** — `src/lib/seed.ts`.

---

This is a simulator for education and practice. Prices are real but all trading is fake — there is no wallet, no transactions, and no real money.
