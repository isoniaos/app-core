import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cacheRootUrl = new URL(
  "../node_modules/.cache/runtime-config-tests/",
  import.meta.url,
);
const cacheRootPath = fileURLToPath(cacheRootUrl);
const loaderOutputUrl = new URL("runtime-config-loader.mjs", cacheRootUrl);

await rm(cacheRootPath, { force: true, recursive: true });
await mkdir(cacheRootPath, { recursive: true });

try {
  await transpileModule(
    new URL("../src/config/runtime-config-loader.ts", import.meta.url),
    loaderOutputUrl,
  );

  const loader = await import(
    `${pathToFileURL(fileURLToPath(loaderOutputUrl)).href}?t=${Date.now()}`
  );

  assertEnvDerivedRuntimeConfig(loader);
  assertJsonDeploymentSelectionAndIsoContracts(loader);
  assertOldGovFieldsAreNotActiveAliases(loader);
  await assertFallbackRuntimeConfig(loader);
  await assertWindowRuntimeConfig(loader);
  await assertConfigUrlRuntimeConfig(loader);
} finally {
  await rm(cacheRootPath, { force: true, recursive: true });
}

console.log(`Runtime config tests passed from ${scriptDir}.`);

async function transpileModule(sourcePath, outputUrl) {
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: fileURLToPath(sourcePath),
  });

  await writeFile(outputUrl, transpiled.outputText, "utf8");
}

function assertEnvDerivedRuntimeConfig(loader) {
  const config = loader.parseRuntimeConfigFromEnv(
    {
      VITE_ISONIA_ACTIVE_CHAIN_ID: "11155111",
      VITE_ISONIA_API_BASE_URL: "http://localhost:3000/",
      VITE_ISONIA_APP_NAME: "IsoniaOS Local",
      VITE_ISONIA_CHAIN_ID: "11155111",
      VITE_ISONIA_CHAIN_NAME: "Sepolia",
      VITE_ISONIA_CORE_ADDRESS: "0x0000000000000000000000000000000000000001",
      VITE_ISONIA_FEATURE_CREATE_PROPOSAL: "true",
      VITE_ISONIA_FEATURE_MANAGE_ORG: "true",
      VITE_ISONIA_FEATURE_WRITE_ACTIONS: "true",
      VITE_ISONIA_NATIVE_CURRENCY_NAME: "Sepolia Ether",
      VITE_ISONIA_NATIVE_CURRENCY_SYMBOL: "ETH",
      VITE_ISONIA_PROPOSALS_ADDRESS:
        "0x0000000000000000000000000000000000000002",
      VITE_ISONIA_REOWN_PROJECT_ID: "reown-project",
      VITE_ISONIA_RPC_URL: "https://sepolia.example.org",
      VITE_ISONIA_WALLET_APP_URL: "http://localhost:5173",
    },
    { loadedAt: "2026-05-27T00:00:00.000Z" },
  );

  assert.equal(config.source.kind, "env");
  assert.equal(config.appName, "IsoniaOS Local");
  assert.equal(config.activeChainId, 11155111);
  assert.equal(config.activeDeployment.chainId, 11155111);
  assert.equal(config.activeDeployment.chainName, "Sepolia");
  assert.equal(
    config.activeDeployment.contracts.isoCoreAddress,
    "0x0000000000000000000000000000000000000001",
  );
  assert.equal(
    config.activeDeployment.contracts.isoProposalsAddress,
    "0x0000000000000000000000000000000000000002",
  );
  assert.equal(config.features.writeActions, true);
  assert.equal(config.features.manageOrg, true);
  assert.equal(config.features.createProposal, true);
  assert.equal(config.wallet.mode, "appkit");
  assert.equal(config.wallet.reownProjectId, "reown-project");
}

function assertJsonDeploymentSelectionAndIsoContracts(loader) {
  const config = loader.parseRuntimeConfig(
    {
      activeChainId: 10,
      apiBaseUrl: "https://api.example.org",
      deployments: [
        {
          chainId: 1,
          chainName: "Mainnet",
          contracts: {
            isoCoreAddress: "0x0000000000000000000000000000000000000001",
          },
          nativeCurrencyName: "Ether",
          nativeCurrencySymbol: "ETH",
          rpcUrl: "https://mainnet.example.org",
        },
        {
          chainId: 10,
          chainName: "Optimism",
          contracts: {
            isoCoreAddress: "0x0000000000000000000000000000000000000010",
            isoProposalsAddress:
              "0x0000000000000000000000000000000000000011",
          },
          localDemoTargetAddress:
            "0x0000000000000000000000000000000000000012",
          nativeCurrencyName: "Ether",
          nativeCurrencySymbol: "ETH",
          rpcUrl: "https://optimism.example.org",
        },
      ],
      features: {
        createProposal: true,
        manageOrg: true,
        writeActions: true,
      },
    },
    { loadedAt: "2026-05-27T00:00:00.000Z" },
  );

  assert.equal(config.activeChainId, 10);
  assert.equal(config.activeDeployment.chainName, "Optimism");
  assert.equal(config.deployments.length, 2);
  assert.equal(
    config.activeDeployment.contracts.isoCoreAddress,
    "0x0000000000000000000000000000000000000010",
  );
  assert.equal(
    config.activeDeployment.contracts.isoProposalsAddress,
    "0x0000000000000000000000000000000000000011",
  );
  assert.equal(
    config.activeDeployment.localDemoTargetAddress,
    "0x0000000000000000000000000000000000000012",
  );
  assert.equal(config.features.writeActions, true);
  assert.equal(config.features.manageOrg, true);
  assert.equal(config.features.createProposal, true);
}

function assertOldGovFieldsAreNotActiveAliases(loader) {
  const config = loader.parseRuntimeConfig(
    {
      activeChainId: 31337,
      deployments: [
        {
          chainId: 31337,
          chainName: "Local",
          contracts: {
            govCoreAddress: "0x0000000000000000000000000000000000000001",
            govProposalsAddress:
              "0x0000000000000000000000000000000000000002",
            demoTargetAddress:
              "0x0000000000000000000000000000000000000003",
          },
          nativeCurrencyName: "Ether",
          nativeCurrencySymbol: "ETH",
          rpcUrl: "http://127.0.0.1:8545",
        },
      ],
      features: {
        createProposal: true,
        manageOrg: true,
        writeActions: true,
      },
      wallet: {
        connectionMode: "appkit",
      },
    },
    { loadedAt: "2026-05-27T00:00:00.000Z" },
  );
  const serialized = JSON.stringify(config);

  assert.equal(config.activeDeployment.contracts.isoCoreAddress, undefined);
  assert.equal(
    config.activeDeployment.contracts.isoProposalsAddress,
    undefined,
  );
  assert.equal(config.activeDeployment.localDemoTargetAddress, undefined);
  assert.equal(config.features.writeActions, false);
  assert.equal(config.features.manageOrg, false);
  assert.equal(config.features.createProposal, false);
  assert.equal(config.wallet.mode, "injected-only");
  assert.doesNotMatch(serialized, /govCoreAddress|govProposalsAddress/);
  assert.doesNotMatch(serialized, /billing|saasAdmin|connectionMode/);
}

async function assertFallbackRuntimeConfig(loader) {
  const config = await loader.loadRuntimeConfig({
    env: {},
    loadedAt: "2026-05-27T00:00:00.000Z",
    windowConfig: undefined,
  });

  assert.equal(config.source.kind, "fallback");
  assert.equal(config.activeDeployment.contracts.isoCoreAddress, undefined);
  assert.equal(
    config.activeDeployment.contracts.isoProposalsAddress,
    undefined,
  );
  assert.equal(config.activeDeployment.localDemoTargetAddress, undefined);
  assert.equal(config.features.writeActions, false);
  assert.equal(config.wallet.mode, "injected-only");
}

async function assertWindowRuntimeConfig(loader) {
  const config = await loader.loadRuntimeConfig({
    loadedAt: "2026-05-27T00:00:00.000Z",
    windowConfig: {
      activeChainId: 8453,
      deployments: [
        {
          chainId: 8453,
          chainName: "Base",
          nativeCurrencyName: "Ether",
          nativeCurrencySymbol: "ETH",
          rpcUrl: "https://base.example.org",
        },
      ],
    },
  });

  assert.equal(config.source.kind, "window");
  assert.equal(config.activeDeployment.chainId, 8453);
}

async function assertConfigUrlRuntimeConfig(loader) {
  const calls = [];
  const config = await loader.loadRuntimeConfig({
    configUrl: "/runtime-config.json",
    fetcher: async (url, init) => {
      calls.push([url, init?.cache]);
      return new Response(
        JSON.stringify({
          activeChainId: 1,
          deployments: [
            {
              chainId: 1,
              chainName: "Mainnet",
              nativeCurrencyName: "Ether",
              nativeCurrencySymbol: "ETH",
              rpcUrl: "https://mainnet.example.org",
            },
          ],
        }),
        { headers: { "content-type": "application/json" }, status: 200 },
      );
    },
    loadedAt: "2026-05-27T00:00:00.000Z",
  });

  assert.deepEqual(calls, [["/runtime-config.json", "no-store"]]);
  assert.equal(config.source.kind, "url");
  assert.equal(config.activeDeployment.chainName, "Mainnet");
}
