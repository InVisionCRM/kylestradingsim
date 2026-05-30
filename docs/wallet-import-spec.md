# Wallet Import + On-Chain Trade Overlay — Spec (v1)

**Status:** scoped — awaiting build go-ahead · **Fidelity:** approximate (candle-close pricing) · **Chains:** EVM only (PulseChain + Ethereum)

## Goal

Paste an EVM wallet address → fetch its token holdings → list them in a **WALLET** group above the watchlist → click a token → load its chart with that wallet's real on-chain **buys (▲)** and **sells (▼)** overlaid, each priced at the candle close for its timestamp.

These markers are visually distinct from your existing paper-trade markers (separate overlay group + different hue) so real-wallet history and your sim trades never get confused.

## Data source

Blockscout v2 REST, called straight from the browser — keyless, CORS-friendly, **no backend**. This is the exact path your site's `WatchlistPanel` already uses, so it's proven:

- PulseChain — `https://api.scan.pulsechain.com/api/v2`
- Ethereum — `https://eth.blockscout.com/api/v2`

(Reuse your `ChainId` + `BLOCKSCOUT_BASE` convention.)

### Endpoint 1 — holdings

`GET /addresses/{wallet}/token-balances`

Returns an array of holdings. Expected shape (to confirm live at build time):

```
[{ token: { address, symbol, name, decimals, icon_url, type, exchange_rate? }, value }]
```

- `value` is a raw integer string → divide by `10 ** decimals`.
- `type` is `"ERC-20" | "ERC-721" | "ERC-1155"` → keep ERC-20 only.
- `exchange_rate` (USD/token) is often present on PulseChain Blockscout → lets us show USD value and filter dust without an extra call.

### Endpoint 2 — trade points

`GET /addresses/{wallet}/token-transfers?token={tokenAddr}&type=ERC-20`

Cursor-paginated via `next_page_params`. Each item:

```
{ timestamp, from:{hash}, to:{hash}, total:{value, decimals}, transaction_hash, method? }
```

- Direction relative to the wallet: `to.hash == wallet` → **IN / acquired (▲)**; `from.hash == wallet` → **OUT / disposed (▼)**.
- `total.value` is raw → convert by `total.decimals`.

## Pricing (approximate — your choice)

For each transfer, drop the marker at the **close of the candle covering its timestamp**, taken from the OHLCV series already loaded for the chart (GeckoTerminal). No extra price request. Tooltip shows date, IN/OUT, token amount, approx price, and a link to the tx on the explorer.

Exact swap-price (parsing the counter-leg of each swap) is explicitly **out of scope for v1** — can be a later upgrade.

## UI

- **Import box** in the LeftPanel header: paste `0x…`, chain auto-detected by querying both bases (mirrors your existing address-paste search). On submit → fetch holdings → render a `WALLET 0xAB…CD` group above `WATCHLIST` (token icon, symbol, balance, USD if available) with a `×` to disconnect.
- **Click a wallet token:** resolve its tradeable pool via DexScreener (token → best pair, same as a watchlist click), `setActivePair`, then fetch that wallet+token's transfers and hand them to the chart as an overlay.
- **Markers:** ▲ buys / ▼ sells in a dedicated `G_WALLET` overlay group, outlined/different hue from sim markers, with a small "wallet" legend. Hover → date · IN/OUT · amount · approx price · tx link.
- **Toggle** to show/hide the wallet-trade overlay (like the slippage toggle).

## State

- New persisted `useWallet` store: `{ address, chainId, holdings: TokenHolding[], status }` + `import()` / `clear()`. **One wallet at a time** — a new import replaces the current one.
- Trades fetched on demand per token, cached in-memory by `${chain}:${wallet}:${token}` (not persisted — cheap to refetch).

## Edge cases & honest caveats

- **Transfer ≠ swap.** Airdrops, plain transfers, LP add/remove, bridges, and CEX deposits all appear as transfers. Markers mean "acquired/disposed," not strictly "DEX fill" — stated in the legend/tooltip.
- **Dust / spam:** ERC-20 only; drop zero balances and (if `exchange_rate` present) sub-threshold USD or tokens with no DexScreener pair.
- **No tradeable pair:** token still lists, but chart click is disabled with a "no market" note.
- **History depth:** **full history** — page through all transfers (Blockscout ~50/page) with sequential, rate-limited fetches and a loading state. Markers thin/cluster when zoomed out so a heavy-trading wallet stays readable.
- **Decimals:** always convert raw `value` / `total.value` by token decimals.
- **Timestamp → candle:** snap each transfer to the nearest candle; if it predates loaded history, omit or cluster at the left edge.
- **Rate limits:** public Blockscout — debounce + sequential fetches with brief pauses; reuse the 30–90s refresh cadence.
- **Solana:** not supported in v1 (Blockscout is EVM only).

## Build steps (on approval)

1. `api/blockscout.ts` — typed `getTokenBalances(chain, wallet)` + `getTokenTransfers(chain, wallet, token)` that pages through full history via `next_page_params`. **First action: live-probe both endpoints to confirm field names.**
2. `state/useWallet.ts` — persisted store + import/clear.
3. `lib/walletTrades.ts` — pure mapper: transfers → `{ ts, side, amount, approxPrice, txUrl }[]` (direction classify, decimals convert, candle-price lookup, dust filter).
4. `LeftPanel.tsx` — import input + WALLET group; click → resolve pair + `setActivePair` + trigger trade fetch.
5. `Chart.tsx` — `G_WALLET` overlay group for ▲/▼ markers + tooltip + show/hide toggle.
6. Wire active-token change → if it belongs to the imported wallet, load + overlay its trades.
7. Tests (pure helpers) → `tsc` + `vitest` + `vite build` → push to GitHub (auto-deploys).

## Decisions (locked)

1. **One wallet at a time** — a new import replaces the current wallet.
2. **Full history** — page through all transfers per token; thin/cluster markers when zoomed out.
3. **Auto-detect chain** — query PulseChain + Ethereum in parallel on paste, use whichever holds the wallet.
