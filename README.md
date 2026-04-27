# Isonia App Core

Public self-hostable React + Vite governance console foundation for IsoniaOS.

This package is a static SPA. It reads governance state from the Isonia Control Plane REST API through `@isonia/sdk`, uses DTOs from `@isonia/types`, and provides a wallet foundation with wagmi, viem, and Reown AppKit.

## Scope

- Organizations list
- Organization overview
- Governance structure
- Proposals list
- Proposal details with route explanation
- Governance graph data view
- Runtime config from `/isonia.config.json`
- Default theme package via `@isonia/theme-default`
- Wallet provider foundation

Not included in this public app core: SaaS overlays, billing, GraphQL, heavy graph visualization, or proposal creation transactions.

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

At startup the app fetches:

```txt
/isonia.config.json
```

For local development, edit `public/isonia.config.json`. For deployment, use `public/isonia.config.example.json` as the complete operator-facing template and place the final file next to the built assets.

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
    "govCore": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "govProposals": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    "demoTarget": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  },
  "features": {
    "createProposal": false,
    "manageOrg": false,
    "advancedAnalytics": false,
    "billing": false,
    "customTheme": false,
    "saasAdmin": false
  },
  "theme": {
    "source": "default"
  },
  "wallet": {
    "reownProjectId": "",
    "appUrl": "https://app.example.org",
    "icons": ["https://app.example.org/icon.png"]
  }
}
```

`billing` and `saasAdmin` are ignored by the public app core.

The wallet config controls the connection UX:

- `reownProjectId`: when set, app-core initializes Reown AppKit for multi-wallet UX.
- Empty `reownProjectId`: app-core stays usable in self-hosted mode and falls back to wagmi's injected connector, suitable for browser wallets such as MetaMask or Rabby.
- `appUrl`: public URL shown in Reown wallet metadata.
- `icons`: public icon URLs used in Reown wallet metadata.

wagmi and viem remain the core EVM interaction layer in both modes. Reown AppKit is only the optional multi-wallet UX layer.

At runtime the app surfaces wallet setup diagnostics for:

- invalid chain or RPC config, which blocks startup and reports the exact bad field;
- Reown initialization failure, which falls back to injected wallet mode;
- missing Reown project ID, which explains that injected wallet fallback is active.

## Shared Packages

Deployable app-core builds depend on pinned GitHub tags:

```json
{
  "@isonia/types": "github:isoniaos/types#v0.1.0",
  "@isonia/sdk": "github:isoniaos/sdk#v0.1.0",
  "@isonia/theme-default": "github:isoniaos/theme-default#v0.1.0"
}
```

Do not duplicate shared DTOs locally. Add shared domain types to `@isonia/types` first.

For local workspace development, `@isonia/theme-default` can be linked from `../theme-default`. Switch the dependency to `github:isoniaos/theme-default#v0.1.0` only after that tag exists in the public theme repository.
