import type { Address } from "@isonia/types";

export interface RuntimeProtocolContractsConfig {
  readonly isoCoreAddress?: Address;
  readonly isoProposalsAddress?: Address;
}

export interface RuntimeDeploymentConfig {
  readonly chainId: number;
  readonly chainName: string;
  readonly rpcUrl: string;
  readonly blockExplorerUrl?: string;
  readonly nativeCurrencyName: string;
  readonly nativeCurrencySymbol: string;
  readonly contracts: RuntimeProtocolContractsConfig;
  readonly localDemoTargetAddress?: Address;
}

export interface RuntimeFeatureFlags {
  readonly createProposal: boolean;
  readonly eip5792Batch: boolean;
  readonly writeActions: boolean;
  readonly manageOrg: boolean;
  readonly advancedAnalytics: boolean;
  readonly customTheme: boolean;
}

export interface RuntimeThemeConfig {
  readonly source: "default" | "package" | "runtime";
  readonly packageName?: string;
}

export interface RuntimeMetadataConfig {
  readonly enabled: boolean;
  readonly ipfsGatewayUrl: string;
  readonly timeoutMs: number;
}

export type RuntimeWalletMode = "appkit" | "injected-only";

export interface RuntimeWalletConfig {
  readonly mode: RuntimeWalletMode;
  readonly reownProjectId: string;
  readonly appUrl: string;
  readonly icons: readonly string[];
}

export type RuntimeConfigSourceKind = "window" | "url" | "env" | "fallback";

export interface RuntimeConfigSource {
  readonly detail: string;
  readonly kind: RuntimeConfigSourceKind;
  readonly loadedAt: string;
}

export interface RuntimeConfig {
  readonly appName: string;
  readonly apiBaseUrl: string;
  readonly activeChainId: number;
  readonly deployments: readonly RuntimeDeploymentConfig[];
  readonly activeDeployment: RuntimeDeploymentConfig;
  readonly features: RuntimeFeatureFlags;
  readonly theme: RuntimeThemeConfig;
  readonly metadata: RuntimeMetadataConfig;
  readonly wallet: RuntimeWalletConfig;
  readonly source: RuntimeConfigSource;
}

export type RuntimeEnv = Readonly<
  Record<string, string | boolean | undefined>
>;

export interface LoadRuntimeConfigOptions {
  readonly configUrl?: string;
  readonly env?: RuntimeEnv;
  readonly fetcher?: typeof fetch;
  readonly loadedAt?: string;
  readonly windowConfig?: unknown;
}

interface ParseRuntimeConfigOptions {
  readonly loadedAt?: string;
  readonly source?: Omit<RuntimeConfigSource, "loadedAt">;
}

const DEFAULT_RUNTIME_DEPLOYMENT: RuntimeDeploymentConfig = {
  chainId: 31337,
  chainName: "Local EVM",
  contracts: {},
  nativeCurrencyName: "Ether",
  nativeCurrencySymbol: "ETH",
  rpcUrl: "http://127.0.0.1:8545",
};

const DEFAULT_RUNTIME_FEATURES: RuntimeFeatureFlags = {
  advancedAnalytics: false,
  createProposal: false,
  customTheme: false,
  eip5792Batch: false,
  manageOrg: false,
  writeActions: false,
};

const DEFAULT_RUNTIME_THEME: RuntimeThemeConfig = {
  source: "default",
};

const DEFAULT_RUNTIME_METADATA: RuntimeMetadataConfig = {
  enabled: true,
  ipfsGatewayUrl: "https://ipfs.io/ipfs/",
  timeoutMs: 1_500,
};

const DEFAULT_RUNTIME_WALLET: Omit<RuntimeWalletConfig, "mode"> = {
  appUrl: "http://localhost:5173",
  icons: [],
  reownProjectId: "",
};

const ISONIA_ENV_KEYS = [
  "VITE_ISONIA_APP_NAME",
  "VITE_ISONIA_API_BASE_URL",
  "VITE_ISONIA_ACTIVE_CHAIN_ID",
  "VITE_ISONIA_CHAIN_ID",
  "VITE_ISONIA_CHAIN_NAME",
  "VITE_ISONIA_RPC_URL",
  "VITE_ISONIA_BLOCK_EXPLORER_URL",
  "VITE_ISONIA_NATIVE_CURRENCY_NAME",
  "VITE_ISONIA_NATIVE_CURRENCY_SYMBOL",
  "VITE_ISONIA_CORE_ADDRESS",
  "VITE_ISONIA_PROPOSALS_ADDRESS",
  "VITE_ISONIA_REOWN_PROJECT_ID",
  "VITE_ISONIA_WALLET_APP_URL",
  "VITE_ISONIA_FEATURE_CREATE_PROPOSAL",
  "VITE_ISONIA_FEATURE_EIP5792_BATCH",
  "VITE_ISONIA_FEATURE_WRITE_ACTIONS",
  "VITE_ISONIA_FEATURE_MANAGE_ORG",
  "VITE_ISONIA_FEATURE_ADVANCED_ANALYTICS",
  "VITE_ISONIA_FEATURE_CUSTOM_THEME",
  "VITE_ISONIA_METADATA_ENABLED",
  "VITE_ISONIA_METADATA_IPFS_GATEWAY_URL",
  "VITE_ISONIA_METADATA_TIMEOUT_MS",
] as const;

declare global {
  interface Window {
    __ISONIA_CONFIG__?: unknown;
  }
}

export async function loadRuntimeConfig(
  configUrlOrOptions?: string | LoadRuntimeConfigOptions,
): Promise<RuntimeConfig> {
  const options =
    typeof configUrlOrOptions === "string"
      ? { configUrl: configUrlOrOptions }
      : configUrlOrOptions ?? {};
  const env = options.env ?? getViteRuntimeEnv();
  const loadedAt = options.loadedAt ?? new Date().toISOString();
  const windowConfig = getWindowRuntimeConfig(options);

  if (windowConfig !== undefined) {
    return parseRuntimeConfig(windowConfig, {
      loadedAt,
      source: {
        detail: "window.__ISONIA_CONFIG__",
        kind: "window",
      },
    });
  }

  const configUrl = readString(
    options.configUrl ?? readEnvString(env, "VITE_ISONIA_CONFIG_URL"),
    "",
  );
  if (configUrl) {
    const loaded = await tryLoadRuntimeConfigUrl(configUrl, {
      fetcher: options.fetcher,
      loadedAt,
    });
    if (loaded) {
      return loaded;
    }
  }

  if (hasIsoniaEnvConfig(env)) {
    return parseRuntimeConfigFromEnv(env, { loadedAt });
  }

  return createDefaultRuntimeConfig({
    detail: configUrl
      ? `No runtime config loaded from ${configUrl}; using safe fallback.`
      : "No runtime config source was provided; using safe fallback.",
    kind: "fallback",
    loadedAt,
  });
}

export function parseRuntimeConfig(
  value: unknown,
  options: ParseRuntimeConfigOptions = {},
): RuntimeConfig {
  const object = asRecord(value);
  const deployments = readDeployments(object);
  const activeChainId = readChainId(
    firstDefined(object.activeChainId, object.chainId),
    deployments[0]?.chainId ?? DEFAULT_RUNTIME_DEPLOYMENT.chainId,
  );
  const activeDeployment = selectRuntimeDeployment(deployments, activeChainId);
  const features = finalizeFeatureFlags(
    readFeatureFlags(asRecord(object.features)),
    activeDeployment,
  );
  const wallet = readWalletConfig(asRecord(object.wallet));

  return {
    activeChainId: activeDeployment.chainId,
    activeDeployment,
    apiBaseUrl: readString(object.apiBaseUrl, "http://localhost:3000"),
    appName: readString(object.appName, "IsoniaOS"),
    deployments,
    features,
    metadata: readMetadataConfig(asRecord(object.metadata)),
    source: createSource(
      options.source ?? { detail: "runtime config object", kind: "url" },
      options.loadedAt,
    ),
    theme: readThemeConfig(asRecord(object.theme)),
    wallet,
  };
}

export function parseRuntimeConfigFromEnv(
  env: RuntimeEnv,
  options: Pick<ParseRuntimeConfigOptions, "loadedAt"> = {},
): RuntimeConfig {
  const deployment: RuntimeDeploymentConfig = {
    blockExplorerUrl: readOptionalString(
      readEnvString(env, "VITE_ISONIA_BLOCK_EXPLORER_URL"),
    ),
    chainId: readChainId(
      readEnvString(env, "VITE_ISONIA_CHAIN_ID"),
      DEFAULT_RUNTIME_DEPLOYMENT.chainId,
    ),
    chainName: readString(
      readEnvString(env, "VITE_ISONIA_CHAIN_NAME"),
      DEFAULT_RUNTIME_DEPLOYMENT.chainName,
    ),
    contracts: {
      isoCoreAddress: readOptionalAddress(
        readEnvString(env, "VITE_ISONIA_CORE_ADDRESS"),
      ),
      isoProposalsAddress: readOptionalAddress(
        readEnvString(env, "VITE_ISONIA_PROPOSALS_ADDRESS"),
      ),
    },
    nativeCurrencyName: readString(
      readEnvString(env, "VITE_ISONIA_NATIVE_CURRENCY_NAME"),
      DEFAULT_RUNTIME_DEPLOYMENT.nativeCurrencyName,
    ),
    nativeCurrencySymbol: readString(
      readEnvString(env, "VITE_ISONIA_NATIVE_CURRENCY_SYMBOL"),
      DEFAULT_RUNTIME_DEPLOYMENT.nativeCurrencySymbol,
    ),
    rpcUrl: readString(
      readEnvString(env, "VITE_ISONIA_RPC_URL"),
      DEFAULT_RUNTIME_DEPLOYMENT.rpcUrl,
    ),
  };
  const activeChainId = readChainId(
    readEnvString(env, "VITE_ISONIA_ACTIVE_CHAIN_ID"),
    deployment.chainId,
  );
  const activeDeployment =
    activeChainId === deployment.chainId
      ? deployment
      : { ...deployment, chainId: activeChainId };
  const requestedFeatures: RuntimeFeatureFlags = {
    advancedAnalytics: readBoolean(
      readEnvValue(env, "VITE_ISONIA_FEATURE_ADVANCED_ANALYTICS"),
      DEFAULT_RUNTIME_FEATURES.advancedAnalytics,
    ),
    createProposal: readBoolean(
      readEnvValue(env, "VITE_ISONIA_FEATURE_CREATE_PROPOSAL"),
      DEFAULT_RUNTIME_FEATURES.createProposal,
    ),
    customTheme: readBoolean(
      readEnvValue(env, "VITE_ISONIA_FEATURE_CUSTOM_THEME"),
      DEFAULT_RUNTIME_FEATURES.customTheme,
    ),
    eip5792Batch: readBoolean(
      readEnvValue(env, "VITE_ISONIA_FEATURE_EIP5792_BATCH"),
      DEFAULT_RUNTIME_FEATURES.eip5792Batch,
    ),
    manageOrg: readBoolean(
      readEnvValue(env, "VITE_ISONIA_FEATURE_MANAGE_ORG"),
      DEFAULT_RUNTIME_FEATURES.manageOrg,
    ),
    writeActions: readBoolean(
      readEnvValue(env, "VITE_ISONIA_FEATURE_WRITE_ACTIONS"),
      DEFAULT_RUNTIME_FEATURES.writeActions,
    ),
  };
  const reownProjectId = readString(
    readEnvString(env, "VITE_ISONIA_REOWN_PROJECT_ID"),
    "",
  );

  return {
    activeChainId: activeDeployment.chainId,
    activeDeployment,
    apiBaseUrl: readString(
      readEnvString(env, "VITE_ISONIA_API_BASE_URL"),
      "http://localhost:3000",
    ),
    appName: readString(readEnvString(env, "VITE_ISONIA_APP_NAME"), "IsoniaOS"),
    deployments: [activeDeployment],
    features: finalizeFeatureFlags(requestedFeatures, activeDeployment),
    metadata: {
      enabled: readBoolean(
        readEnvValue(env, "VITE_ISONIA_METADATA_ENABLED"),
        DEFAULT_RUNTIME_METADATA.enabled,
      ),
      ipfsGatewayUrl: readString(
        readEnvString(env, "VITE_ISONIA_METADATA_IPFS_GATEWAY_URL"),
        DEFAULT_RUNTIME_METADATA.ipfsGatewayUrl,
      ),
      timeoutMs: readPositiveInteger(
        readEnvString(env, "VITE_ISONIA_METADATA_TIMEOUT_MS"),
        DEFAULT_RUNTIME_METADATA.timeoutMs,
      ),
    },
    source: createSource(
      {
        detail: "VITE_ISONIA_* environment variables",
        kind: "env",
      },
      options.loadedAt,
    ),
    theme: DEFAULT_RUNTIME_THEME,
    wallet: {
      appUrl: readString(
        readEnvString(env, "VITE_ISONIA_WALLET_APP_URL"),
        DEFAULT_RUNTIME_WALLET.appUrl,
      ),
      icons: [],
      mode: deriveWalletMode(reownProjectId),
      reownProjectId,
    },
  };
}

export function selectRuntimeDeployment(
  deployments: readonly RuntimeDeploymentConfig[],
  activeChainId: number,
): RuntimeDeploymentConfig {
  return (
    deployments.find((deployment) => deployment.chainId === activeChainId) ??
    deployments[0] ??
    DEFAULT_RUNTIME_DEPLOYMENT
  );
}

function createDefaultRuntimeConfig(source: RuntimeConfigSource): RuntimeConfig {
  const activeDeployment = DEFAULT_RUNTIME_DEPLOYMENT;
  return {
    activeChainId: activeDeployment.chainId,
    activeDeployment,
    apiBaseUrl: "http://localhost:3000",
    appName: "IsoniaOS",
    deployments: [activeDeployment],
    features: DEFAULT_RUNTIME_FEATURES,
    metadata: DEFAULT_RUNTIME_METADATA,
    source,
    theme: DEFAULT_RUNTIME_THEME,
    wallet: {
      ...DEFAULT_RUNTIME_WALLET,
      mode: "injected-only",
    },
  };
}

async function tryLoadRuntimeConfigUrl(
  configUrl: string,
  options: {
    readonly fetcher: typeof fetch | undefined;
    readonly loadedAt: string;
  },
): Promise<RuntimeConfig | undefined> {
  const fetcher = options.fetcher ?? getDefaultFetch();
  if (!fetcher) {
    console.warn("No fetch implementation is available for runtime config.");
    return undefined;
  }

  try {
    const response = await fetcher(configUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new RuntimeConfigHttpError(configUrl, response);
    }
    return parseRuntimeConfig(await response.json(), {
      loadedAt: options.loadedAt,
      source: {
        detail: configUrl,
        kind: "url",
      },
    });
  } catch (error) {
    console.warn(
      `Unable to load IsoniaOS runtime config from ${configUrl}.`,
      error,
    );
    return undefined;
  }
}

class RuntimeConfigHttpError extends Error {
  readonly status: number;

  constructor(configUrl: string, response: Response) {
    super(
      `Unable to fetch runtime config from ${configUrl}: HTTP ${response.status} ${response.statusText}`,
    );
    this.name = "RuntimeConfigHttpError";
    this.status = response.status;
  }
}

function readDeployments(
  object: Readonly<Record<string, unknown>>,
): readonly RuntimeDeploymentConfig[] {
  if (Array.isArray(object.deployments)) {
    const deployments = object.deployments.map(readDeploymentConfig);
    return deployments.length > 0 ? deployments : [DEFAULT_RUNTIME_DEPLOYMENT];
  }

  return [readDeploymentConfig(object)];
}

function readDeploymentConfig(value: unknown): RuntimeDeploymentConfig {
  const object = asRecord(value);
  const contracts = asRecord(object.contracts);

  return {
    blockExplorerUrl: readOptionalString(object.blockExplorerUrl),
    chainId: readChainId(
      object.chainId,
      DEFAULT_RUNTIME_DEPLOYMENT.chainId,
    ),
    chainName: readString(
      object.chainName,
      DEFAULT_RUNTIME_DEPLOYMENT.chainName,
    ),
    contracts: {
      isoCoreAddress: readOptionalAddress(
        firstDefined(contracts.isoCoreAddress, object.isoCoreAddress),
      ),
      isoProposalsAddress: readOptionalAddress(
        firstDefined(
          contracts.isoProposalsAddress,
          object.isoProposalsAddress,
        ),
      ),
    },
    localDemoTargetAddress: readOptionalAddress(object.localDemoTargetAddress),
    nativeCurrencyName: readString(
      object.nativeCurrencyName,
      DEFAULT_RUNTIME_DEPLOYMENT.nativeCurrencyName,
    ),
    nativeCurrencySymbol: readString(
      object.nativeCurrencySymbol,
      DEFAULT_RUNTIME_DEPLOYMENT.nativeCurrencySymbol,
    ),
    rpcUrl: readString(object.rpcUrl, DEFAULT_RUNTIME_DEPLOYMENT.rpcUrl),
  };
}

function readFeatureFlags(
  features: Readonly<Record<string, unknown>>,
): RuntimeFeatureFlags {
  return {
    advancedAnalytics: readBoolean(
      features.advancedAnalytics,
      DEFAULT_RUNTIME_FEATURES.advancedAnalytics,
    ),
    createProposal: readBoolean(
      features.createProposal,
      DEFAULT_RUNTIME_FEATURES.createProposal,
    ),
    customTheme: readBoolean(
      features.customTheme,
      DEFAULT_RUNTIME_FEATURES.customTheme,
    ),
    eip5792Batch: readBoolean(
      features.eip5792Batch,
      DEFAULT_RUNTIME_FEATURES.eip5792Batch,
    ),
    manageOrg: readBoolean(
      features.manageOrg,
      DEFAULT_RUNTIME_FEATURES.manageOrg,
    ),
    writeActions: readBoolean(
      features.writeActions,
      DEFAULT_RUNTIME_FEATURES.writeActions,
    ),
  };
}

function finalizeFeatureFlags(
  requested: RuntimeFeatureFlags,
  deployment: RuntimeDeploymentConfig,
): RuntimeFeatureFlags {
  const isoCoreConfigured = Boolean(deployment.contracts.isoCoreAddress);
  const isoProposalsConfigured = Boolean(
    deployment.contracts.isoProposalsAddress,
  );
  const anyProtocolContractConfigured =
    isoCoreConfigured || isoProposalsConfigured;
  const writeActions =
    requested.writeActions && anyProtocolContractConfigured;

  return {
    advancedAnalytics: requested.advancedAnalytics,
    createProposal:
      requested.createProposal && writeActions && isoProposalsConfigured,
    customTheme: requested.customTheme,
    eip5792Batch:
      requested.eip5792Batch && writeActions && isoCoreConfigured,
    manageOrg: requested.manageOrg && writeActions && isoCoreConfigured,
    writeActions,
  };
}

function readThemeConfig(
  theme: Readonly<Record<string, unknown>>,
): RuntimeThemeConfig {
  return {
    packageName: readOptionalString(theme.packageName),
    source: readThemeSource(theme.source, DEFAULT_RUNTIME_THEME.source),
  };
}

function readMetadataConfig(
  metadata: Readonly<Record<string, unknown>>,
): RuntimeMetadataConfig {
  return {
    enabled: readBoolean(
      metadata.enabled,
      DEFAULT_RUNTIME_METADATA.enabled,
    ),
    ipfsGatewayUrl: readString(
      metadata.ipfsGatewayUrl,
      DEFAULT_RUNTIME_METADATA.ipfsGatewayUrl,
    ),
    timeoutMs: readPositiveInteger(
      metadata.timeoutMs,
      DEFAULT_RUNTIME_METADATA.timeoutMs,
    ),
  };
}

function readWalletConfig(
  wallet: Readonly<Record<string, unknown>>,
): RuntimeWalletConfig {
  const reownProjectId = readString(wallet.reownProjectId, "");
  return {
    appUrl: readString(wallet.appUrl, DEFAULT_RUNTIME_WALLET.appUrl),
    icons: readStringArray(wallet.icons),
    mode: deriveWalletMode(reownProjectId),
    reownProjectId,
  };
}

function deriveWalletMode(reownProjectId: string): RuntimeWalletMode {
  return reownProjectId.trim().length > 0 ? "appkit" : "injected-only";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function firstDefined(...values: readonly unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_RUNTIME_WALLET.icons;
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readChainId(value: unknown, fallback: number): number {
  const parsed = readNumber(value, fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  const parsed = readNumber(value, fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function readThemeSource(
  value: unknown,
  fallback: RuntimeThemeConfig["source"],
): RuntimeThemeConfig["source"] {
  return value === "default" || value === "package" || value === "runtime"
    ? value
    : fallback;
}

function readOptionalAddress(value: unknown): Address | undefined {
  return isAddress(value) && !isZeroAddress(value) ? value : undefined;
}

function isAddress(value: unknown): value is Address {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isZeroAddress(value: Address): boolean {
  return /^0x0{40}$/i.test(value);
}

function readEnvValue(env: RuntimeEnv, key: string): string | boolean | undefined {
  return env[key];
}

function readEnvString(env: RuntimeEnv, key: string): string | undefined {
  const value = readEnvValue(env, key);
  return typeof value === "string" ? value : undefined;
}

function hasIsoniaEnvConfig(env: RuntimeEnv): boolean {
  return ISONIA_ENV_KEYS.some((key) => readEnvString(env, key) !== undefined);
}

function getViteRuntimeEnv(): RuntimeEnv {
  return (
    (import.meta as ImportMeta & { readonly env?: RuntimeEnv }).env ?? {}
  );
}

function getWindowRuntimeConfig(
  options: LoadRuntimeConfigOptions,
): unknown | undefined {
  if (Object.prototype.hasOwnProperty.call(options, "windowConfig")) {
    return options.windowConfig;
  }

  if (typeof window === "undefined") {
    return undefined;
  }

  return window.__ISONIA_CONFIG__;
}

function getDefaultFetch(): typeof fetch | undefined {
  return typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : undefined;
}

function createSource(
  source: Omit<RuntimeConfigSource, "loadedAt">,
  loadedAt?: string,
): RuntimeConfigSource {
  return {
    ...source,
    loadedAt: loadedAt ?? new Date().toISOString(),
  };
}
