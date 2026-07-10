# CORETAP

A minimal onchain clicker game on the Unicity testnet, built with the real
`@unicitylabs/sphere-sdk` npm package. Each tap sends 1 base unit of UCT to a
sink address — your score is your real, verifiable transaction count.

## Setup

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## Before this fully works, you need to:

1. **Set your own nametag.** `MY_NAMETAG` in `src/main.js` claims a Unicity
   ID (`@handle`) as part of `Sphere.init()` — this is confirmed from the
   real SDK quickstart. Change `'coretap-player'` to whatever handle you
   want. Note: the SDK docs mention that *receiving* funds via a nametag
   also needs a separate on-chain mint step — check `docs/UNICITY-ID.md` in
   the `sphere-sdk` repo after installing for the details.

2. **Set a real sink address.** `SINK_NAMETAG` is a placeholder
   (`@coretap-sink`) that probably doesn't exist. Point it at any `@handle`
   you control — sending to your own second wallet works fine for scoring
   purposes, since the point is just a confirmable transaction.

3. **Fund your wallet from the testnet faucet.** There's no single
   programmatic faucet call bundled into a generic SDK method as far as I
   could confirm. The real flow, per the SDK's own docs: claim a Unicity ID
   first (handled automatically above via `nametag` in `Sphere.init`), then
   follow the Node.js or Browser quick-start guide in the `sphere-sdk` repo
   for the concrete faucet request steps, or use the Sphere wallet app's own
   "Top Up" button on the same wallet (same recovery phrase). Click "Faucet
   instructions" in the app for a console reminder of this flow.

4. **Watch for a Buffer polyfill error.** `sphere-sdk`'s real dependencies
   (confirmed from its `package.json`) include `buffer`, `crypto-js`, and
   `elliptic` — packages written with Node's `Buffer` global in mind. Vite
   doesn't polyfill Node globals for the browser by default. If you see
   `Buffer is not defined` in the console, run:
   ```bash
   npm install --save-dev vite-plugin-node-polyfills
   ```
   and uncomment the plugin in `vite.config.js`.

## How it works

- `Sphere.init()` creates or loads a browser wallet from a recovery phrase
  stored in this browser's local storage, and claims your nametag.
- Each tap on the hexagon queues a `sphere.payments.send()` call for 1 base
  unit of UCT (UCT uses 6 decimals per the SDK's own docs, so this is a tiny
  fraction of 1 UCT — cheap and frequent by design). Taps are drained one at
  a time so you can watch each one move from pending to confirmed in the
  ledger panel.
- Your on-screen score is the count of confirmed sends, not a token balance.

## Known limitations

- No error recovery UI beyond a status label — a failed send just marks that
  ledger row as failed and moves on.
- The recovery phrase is only logged to the browser console on wallet
  creation. For anything beyond local learning, replace this with a proper
  "write this down" modal before shipping.
- Rapid clicking queues sends faster than testnet finality, so score lags
  slightly behind taps under heavy clicking — this is honest, not a bug.
- If you'd rather see a real reference implementation before extending this
  further, `unicity-sphere/sphere-sdk-connect-example` on GitHub has a
  working Vite + React browser dApp you can compare against.

