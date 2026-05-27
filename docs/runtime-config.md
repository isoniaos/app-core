# Runtime Config

App Core runtime config is loaded by `src/config/runtime-config-loader.ts` and exposed through the React provider in `src/config/runtime-config.tsx`.

## Load Order

1. `window.__ISONIA_CONFIG__`
2. `VITE_ISONIA_CONFIG_URL`
3. `VITE_ISONIA_*` environment variables
4. safe fallback with no protocol addresses and writes disabled

The fallback keeps App Core bootable for read-only UI development. It does not include demo or protocol contract addresses.

## Deployment Shape

Runtime config is deployment-array oriented:

```json
{
  "appName": "IsoniaOS",
  "apiBaseUrl": "https://control-plane.example.org",
  "activeChainId": 1,
  "deployments": [
    {
      "chainId": 1,
      "chainName": "Example EVM Network",
      "rpcUrl": "https://rpc.example.org",
      "blockExplorerUrl": "https://explorer.example.org",
      "nativeCurrencyName": "Ether",
      "nativeCurrencySymbol": "ETH",
      "contracts": {
        "isoCoreAddress": "0x0000000000000000000000000000000000000000",
        "isoProposalsAddress": "0x0000000000000000000000000000000000000000"
      }
    }
  ]
}
```

`activeChainId` selects the deployment. If it is omitted, App Core uses the first deployment. Zero addresses are treated as unconfigured.

Optional local-only proposal target support belongs on the deployment as `localDemoTargetAddress`, not inside `contracts`.

## Vite Environment Variables

Use `.env.example` as the local template. Current variables:

- `VITE_ISONIA_APP_NAME`
- `VITE_ISONIA_API_BASE_URL`
- `VITE_ISONIA_ACTIVE_CHAIN_ID`
- `VITE_ISONIA_CHAIN_ID`
- `VITE_ISONIA_CHAIN_NAME`
- `VITE_ISONIA_RPC_URL`
- `VITE_ISONIA_BLOCK_EXPLORER_URL`
- `VITE_ISONIA_NATIVE_CURRENCY_NAME`
- `VITE_ISONIA_NATIVE_CURRENCY_SYMBOL`
- `VITE_ISONIA_CORE_ADDRESS`
- `VITE_ISONIA_PROPOSALS_ADDRESS`
- `VITE_ISONIA_REOWN_PROJECT_ID`
- `VITE_ISONIA_WALLET_APP_URL`
- `VITE_ISONIA_CONFIG_URL`
- `VITE_ISONIA_FEATURE_CREATE_PROPOSAL`
- `VITE_ISONIA_FEATURE_EIP5792_BATCH`
- `VITE_ISONIA_FEATURE_WRITE_ACTIONS`
- `VITE_ISONIA_FEATURE_MANAGE_ORG`
- `VITE_ISONIA_FEATURE_ADVANCED_ANALYTICS`
- `VITE_ISONIA_FEATURE_CUSTOM_THEME`
- `VITE_ISONIA_METADATA_ENABLED`
- `VITE_ISONIA_METADATA_IPFS_GATEWAY_URL`
- `VITE_ISONIA_METADATA_TIMEOUT_MS`

Boolean values accept `true`, `false`, `1`, `0`, `yes`, `no`, `on`, and `off`.

Write features stay disabled unless the relevant feature flag and required `iso*` contract address are present.

## Wallet Mode

Wallet mode is derived:

- non-empty `wallet.reownProjectId` or `VITE_ISONIA_REOWN_PROJECT_ID` enables Reown/AppKit;
- missing Reown project ID uses injected-only wallet mode.

Do not add a separate required wallet mode setting for normal local development.

## Local Config Files

`public/isonia.config.example.json` is a placeholder example only. Active local JSON files are ignored:

- `public/isonia.config.json`
- `public/isonia.config.local.json`
- stage/dev/prod variants listed in `.gitignore`

Do not commit local Hardhat contract addresses or local demo targets as active defaults.
