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
- Default CSS variable theme provider
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

## Runtime Config

At startup the app fetches:

```txt
/isonia.config.json
```

For local development, edit `public/isonia.config.json`. For self-hosted deployment, place the file next to the built assets so operators can change API, chain, contract, and wallet settings without rebuilding the app.

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
    "icons": []
  }
}
```

`billing` and `saasAdmin` are ignored by the public app core.

## Shared Packages

Deployable app-core builds depend on pinned GitHub tags:

```json
{
  "@isonia/types": "github:isoniaos/types#v0.1.0",
  "@isonia/sdk": "github:isoniaos/sdk#v0.1.0"
}
```

Do not duplicate shared DTOs locally. Add shared domain types to `@isonia/types` first.
