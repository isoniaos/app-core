# Isonia App Core

Public self-hostable React + Vite governance console foundation for IsoniaOS.

This package is a static SPA. It reads governance state from the Isonia Control Plane REST API through `@isonia/sdk`, uses DTOs from `@isonia/types`, and provides a wallet foundation with wagmi, viem, and Reown AppKit.

## Scope

- Organizations list
- Organization overview
- Governance structure
- Proposals list
- Proposal details with route explanation
- Create proposal transaction flow gated by runtime config
- Proposal action transaction flows for approve, veto, queue, execute, and cancel
- Governance graph data view
- Control Plane diagnostics at `/diagnostics`
- Runtime config from `/isonia.config.local.json` with fallback to `/isonia.config.json`
- Default theme package via `@isonia/theme-default`
- Wallet provider foundation

Not included in this public app core: SaaS overlays, billing, GraphQL, heavy graph visualization, arbitrary calldata builders, Safe integration, or real IPFS publishing.

## Install

```sh
pnpm install
```

## Develop

```sh
pnpm dev
```

The default Vite URL is `http://localhost:5173`.

## Build

```sh
pnpm build
```

The build output is written to `dist/` and can be served by any static web server. Configure the server to return `index.html` for application routes such as `/orgs/1/proposals/2`.

## Self-Hosted Deployment

1. Build the static app:

   ```sh
   pnpm build
   ```

2. Copy or template `public/isonia.config.example.json` to `dist/isonia.config.json`.
3. Set the deployment values in `dist/isonia.config.json`: `apiBaseUrl`, chain metadata, `rpcUrl`, contract addresses, theme source, and wallet fields.
4. Serve `dist/` from a static host or CDN, with SPA fallback to `index.html`.

Runtime config is intentionally separate from the bundle. Operators can move the same build across environments by replacing only `isonia.config.json`.

## Runtime Config

At startup the app first fetches the optional local override:

```txt
/isonia.config.local.json
```

If that request returns 404, the app falls back to the committed/default runtime config path:

```txt
/isonia.config.json
```

For local development, copy `public/isonia.config.example.json` or `public/isonia.config.json` to `public/isonia.config.local.json` and edit that file. The local override is ignored by git, so it can hold machine-specific endpoints or a local Reown Project ID without committing secrets or operator-specific values.

Keep committed configs free of real Reown Project IDs. Use an empty `wallet.reownProjectId` in committed defaults and examples so app-core falls back to injected wallet mode when no local or deployment-specific project ID is provided.

For deployment, use `public/isonia.config.example.json` as the complete operator-facing template and place the final file next to the built assets as `isonia.config.json`.

Example:

```json
{
  "appName": "IsoniaOS",
  "mode": "self-hosted",
  "apiBaseUrl": "https://control-plane.example.org",
  "chainId": 31337,
  "chainName": "Hardhat Local",
  "rpcUrl": "http://127.0.0.1:8545",
  "blockExplorerUrl": "https://explorer.example.org",
  "nativeCurrencyName": "Ether",
  "nativeCurrencySymbol": "ETH",
  "contracts": {
    "govCoreAddress": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "govProposalsAddress": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    "demoTargetAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  },
  "features": {
    "createProposal": false,
    "writeActions": false,
    "manageOrg": false,
    "advancedAnalytics": false,
    "billing": false,
    "customTheme": false,
    "saasAdmin": false
  },
  "theme": {
    "source": "default"
  },
  "metadata": {
    "enabled": true,
    "ipfsGatewayUrl": "https://ipfs.io/ipfs/",
    "timeoutMs": 1500
  },
  "wallet": {
    "reownProjectId": "",
    "appUrl": "https://app.example.org",
    "icons": ["https://app.example.org/icon.png"]
  }
}
```

`writeActions` is the broad public app-core write gate for proposal actions. `createProposal` enables only the create proposal flow. Both must be true before the Create proposal button appears.

The proposal details screen shows approve, veto, queue, execute, and cancel controls when `writeActions` is enabled and the proposal or route state makes the action relevant. These controls are UI hints only; the GovProposals contract decides authority and final validity. After a transaction receipt is confirmed, app-core polls Control Plane until proposal details or the route explanation reflect the indexed event.

Execution remains intentionally narrow in v0.1. The public app core only builds the configured `DemoTarget.setNumber(orgId, newNumber)` action data and verifies its hash against the indexed proposal `dataHash` before calling `executeProposal`; it does not provide an arbitrary calldata builder.

The `/diagnostics` route reads `client.diagnostics.get()` from `@isonia/sdk` and renders the shared `DiagnosticsDto`. It shows API version, chain blocks, configured contract addresses, indexer cursors, raw event counts, projection backlog/failures, stale data indicators, and the latest projection error summary. The app shell also links to this route through a compact global system status indicator.

`billing` and `saasAdmin` are ignored by the public app core.

The metadata config controls optional read-only metadata resolution:

- `enabled`: when false, app-core never fetches metadata and uses deterministic fallback labels.
- `ipfsGatewayUrl`: HTTP gateway prefix used to normalize `ipfs://` URIs, for example `https://ipfs.io/ipfs/`.
- `timeoutMs`: fetch timeout for metadata lookups. Metadata failures never block or break governance screens.

The local demo includes lightweight built-in metadata for known seed URIs such as `ipfs://simple-general-council` and `ipfs://role-1`; unknown URIs fall back safely to labels such as `Body #id`, `Role #id`, and `Proposal #id`.

The wallet config controls the connection UX:

- `reownProjectId`: when set, app-core initializes Reown AppKit for multi-wallet UX.
- Empty `reownProjectId`: app-core stays usable in self-hosted mode and falls back to wagmi's injected connector, suitable for browser wallets such as MetaMask or Rabby.
- `appUrl`: public URL shown in Reown wallet metadata.
- `icons`: public icon URLs used in Reown wallet metadata.

wagmi and viem remain the core EVM interaction layer in both modes. Reown AppKit is only the optional multi-wallet UX layer.

App-core feature code must read wallet connection state through `src/wallet/useWalletConnection.ts`. Do not import Wagmi account or connection-state hooks directly in feature components or feature hooks; keep Wagmi connection API changes contained in that project adapter.

At runtime the app surfaces wallet setup diagnostics for:

- invalid chain or RPC config, which blocks startup and reports the exact bad field;
- Reown initialization failure, which falls back to injected wallet mode;
- missing Reown project ID, which explains that injected wallet fallback is active.

## Shared Packages

Deployable app-core builds depend on pinned GitHub tags:

```json
{
  "@isonia/types": "github:isoniaos/types#v0.5.0-alpha.1",
  "@isonia/sdk": "github:isoniaos/sdk#v0.5.0-alpha.1",
  "@isonia/theme-default": "github:isoniaos/theme-default#v0.1.0"
}
```

Do not duplicate shared DTOs locally. Add shared domain types to `@isonia/types` first.

For v0.5 workspace development, TypeScript and Vite resolve `@isonia/types` and `@isonia/sdk` to the adjacent `../types/src` and `../sdk/src` sources so app-core can consume current shared DTOs and SDK clients while alpha package tags are being prepared.

For local workspace development, `@isonia/theme-default` can be linked from `../theme-default`. Switch the dependency to `github:isoniaos/theme-default#v0.1.0` only after that tag exists in the public theme repository.
