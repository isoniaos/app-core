# IsoniaOS App Core

App Core is the public self-hostable IsoniaOS governance console. It is a React and Vite single-page application for reading, explaining, and interacting with IsoniaOS governance state through Control Plane APIs and configured EVM deployments.

App Core is not governance authority. It presents contract-modeled state, Control Plane read models, wallet transaction flows, source disclosure, and trust-boundary UI. The public developer overview is in [site/developers/index.md](https://github.com/isoniaos/docs/blob/main/site/developers/index.md).

## Installation

Requires Node.js 22 or newer and pnpm through Corepack.

During coordinated alpha work inside the private workspace, install from the workspace root so local `@isonia/sdk`, `@isonia/types`, and `@isonia/theme-default` packages resolve through `workspace:*` links:

```bash
corepack pnpm install
```

Standalone installs of this alpha manifest require the sibling workspace packages. Use a released compatibility set, pinned tags, or immutable commits when installing outside the private workspace.

## Configuration

Runtime configuration is loaded by [`src/config/runtime-config-loader.ts`](src/config/runtime-config-loader.ts) and provided through [`src/config/runtime-config.tsx`](src/config/runtime-config.tsx).

Load order:

1. `window.__ISONIA_CONFIG__`
2. `VITE_ISONIA_CONFIG_URL`
3. `VITE_ISONIA_*` environment variables
4. safe built-in fallback with no protocol contract addresses and writes disabled

Committed examples live in [`public/isonia.config.example.json`](public/isonia.config.example.json) and [`.env.example`](.env.example). Do not commit active `public/isonia.config.json` or `public/isonia.config.local.json` files.

Current runtime config fields:

- `appName`
- `apiBaseUrl`
- `activeChainId`
- `deployments[]`, keyed by `chainId`
- `deployments[].contracts.isoCoreAddress`
- `deployments[].contracts.isoProposalsAddress`
- `deployments[].localDemoTargetAddress`, optional local-only proposal target support
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
- `wallet.reownProjectId`
- `wallet.appUrl`
- `wallet.icons`

Wallet mode is derived automatically. A non-empty Reown project ID enables the Reown/AppKit path; otherwise App Core uses injected-only wallet mode. SaaS billing and tenant-admin flags are not active App Core runtime config.

Default visual tokens, color-mode CSS variables, brand metadata, assets, and Chakra token config come from `@isonia/theme-default`. App Core owns screen and component behavior; the package owns reusable theme primitives.

Build-time workspace-source aliases remain opt-in for direct source testing:

```bash
ISONIA_WORKSPACE_SOURCES=true corepack pnpm typecheck
ISONIA_WORKSPACE_SOURCES=true corepack pnpm build
```

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

- If startup uses fallback config, provide `VITE_ISONIA_*` variables, `VITE_ISONIA_CONFIG_URL`, or `window.__ISONIA_CONFIG__`.
- If writes are disabled, confirm `features.writeActions`, the specific write feature, and the required `iso*` protocol addresses are set for the active deployment.
- If wallet connection stays injected-only, configure `VITE_ISONIA_REOWN_PROJECT_ID` or `wallet.reownProjectId`.
- If metadata labels are missing, check `metadata.enabled`, `metadata.ipfsGatewayUrl`, and `metadata.timeoutMs`. Built-in seed metadata is only a local fallback.
- If workspace installs fail from inside `app-core`, run install/build/test commands from the private workspace root while this alpha manifest uses `workspace:*` dependencies.

## Contribution

Read [`AGENTS.md`](AGENTS.md) before editing. Use `@isonia/sdk` for typed Control Plane calls when available and `@isonia/types` for shared DTOs, enums, and constants. Keep source disclosure, stale/error states, and trust boundaries visible near affected data.

Update the smallest relevant local docs and the public docs repository when UI behavior, configuration, wallet behavior, data trust boundaries, or user/developer/operator-visible flows change.

## License

MIT. See [`LICENSE`](LICENSE).
