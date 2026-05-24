# IsoniaOS App Core

App Core is the public self-hostable IsoniaOS governance console. It is a React and Vite single-page application for reading, explaining, and interacting with IsoniaOS governance state through Control Plane APIs and configured EVM contracts.

App Core is not governance authority. It presents contract-modeled state, Control Plane read models, wallet transaction flows, source disclosure, and trust-boundary UI. The public developer overview is in [site/developers/app-core.md](https://github.com/isoniaos/docs/blob/main/site/developers/app-core.md).

## Installation

Requires Node.js 22 or newer and pnpm through Corepack.

```bash
corepack pnpm install
```

## Configuration

Runtime configuration is loaded by [`src/config/runtime-config.tsx`](src/config/runtime-config.tsx). The app tries `/isonia.config.local.json` first, then `/isonia.config.json`, and falls back to the built-in local defaults if no config can be loaded.

Committed examples live in [`public/isonia.config.example.json`](public/isonia.config.example.json), [`public/isonia.config.json`](public/isonia.config.json), and [`public/isonia.config.local.json`](public/isonia.config.local.json).

Current runtime config fields:

- `appName`
- `mode`: `self-hosted`, `hosted-free`, or `saas`
- `apiBaseUrl`
- `chainId`
- `chainName`
- `rpcUrl`
- `blockExplorerUrl`
- `nativeCurrencyName`
- `nativeCurrencySymbol`
- `contracts.govCoreAddress`
- `contracts.govProposalsAddress`
- `contracts.demoTargetAddress` for local/lab proposal flows
- `features.createProposal`
- `features.eip5792Batch`
- `features.writeActions`
- `features.manageOrg`
- `features.advancedAnalytics`
- `features.customTheme`
- `theme.source`
- `theme.packageName`
- `metadata.enabled`
- `metadata.ipfsGatewayUrl`
- `metadata.timeoutMs`
- `wallet.connectionMode`: `auto`, `appkit`, or `injected-only`
- `wallet.reownProjectId`
- `wallet.appUrl`
- `wallet.icons`

`features.billing` and `features.saasAdmin` are not enabled by the current parser and must not be treated as active public or SaaS functionality.

Build-time workspace-source aliases are opt-in:

```bash
ISONIA_WORKSPACE_SOURCES=true corepack pnpm typecheck
ISONIA_WORKSPACE_SOURCES=true corepack pnpm build
```

When enabled, Vite resolves `@isonia/sdk` and `@isonia/types` from adjacent workspace source directories.

## Run / Usage

Start the development server:

```bash
corepack pnpm dev
```

Run checks:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Preview a production build:

```bash
corepack pnpm preview
```

## Troubleshooting

- If startup falls back to default config, check that `/isonia.config.local.json` or `/isonia.config.json` is valid JSON and served from `public/`.
- If wallet writes are disabled, confirm `features.writeActions`, `features.manageOrg`, configured contract addresses, and the connected wallet chain.
- If wallet connection stays injected-only, check `wallet.connectionMode` and `wallet.reownProjectId`. Missing or failed Reown AppKit setup falls back to injected wallet mode.
- If metadata labels are missing, check `metadata.enabled`, `metadata.ipfsGatewayUrl`, and `metadata.timeoutMs`. Built-in seed metadata is only a local fallback.
- If workspace-source builds fail, confirm adjacent `../types` and `../sdk` source trees are present.

## Contribution

Read [`AGENTS.md`](AGENTS.md) before editing. Use `@isonia/sdk` for typed Control Plane calls when available and `@isonia/types` for shared DTOs, enums, and constants. Keep source disclosure, stale/error states, and trust boundaries visible near affected data.

Update the smallest relevant local docs and the public docs repository when UI behavior, configuration, wallet behavior, data trust boundaries, or user/developer/operator-visible flows change.

## License

MIT. See [`LICENSE`](LICENSE).
