import {
  createContext,
  type PropsWithChildren,
  useContext,
} from "react";
import type { Address } from "@isonia/types";

export type RuntimeMode = "self-hosted" | "hosted-free" | "saas";

export interface RuntimeFeatureFlags {
  readonly createProposal: boolean;
  readonly writeActions: boolean;
  readonly manageOrg: boolean;
  readonly advancedAnalytics: boolean;
  readonly billing: boolean;
  readonly customTheme: boolean;
  readonly saasAdmin: boolean;
}

export interface RuntimeContracts {
  readonly govCoreAddress: Address;
  readonly govProposalsAddress: Address;
  readonly demoTargetAddress?: Address;
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

export interface RuntimeWalletConfig {
  readonly reownProjectId: string;
  readonly appUrl: string;
  readonly icons: readonly string[];
}

export interface RuntimeConfig {
  readonly appName: string;
  readonly mode: RuntimeMode;
  readonly apiBaseUrl: string;
  readonly chainId: number;
  readonly chainName: string;
  readonly rpcUrl: string;
  readonly blockExplorerUrl?: string;
  readonly nativeCurrencyName: string;
  readonly nativeCurrencySymbol: string;
  readonly contracts: RuntimeContracts;
  readonly features: RuntimeFeatureFlags;
  readonly theme: RuntimeThemeConfig;
  readonly metadata: RuntimeMetadataConfig;
  readonly wallet: RuntimeWalletConfig;
}

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  appName: "IsoniaOS",
  mode: "self-hosted",
  apiBaseUrl: "http://localhost:3000",
  chainId: 31337,
  chainName: "Hardhat Local",
  rpcUrl: "http://127.0.0.1:8545",
  nativeCurrencyName: "Ether",
  nativeCurrencySymbol: "ETH",
  contracts: {
    govCoreAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    govProposalsAddress: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    demoTargetAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  },
  features: {
    createProposal: false,
    writeActions: false,
    manageOrg: false,
    advancedAnalytics: false,
    billing: false,
    customTheme: false,
    saasAdmin: false,
  },
  theme: {
    source: "default",
  },
  metadata: {
    enabled: true,
    ipfsGatewayUrl: "https://ipfs.io/ipfs/",
    timeoutMs: 1_500,
  },
  wallet: {
    reownProjectId: "",
    appUrl: "http://localhost:5173",
    icons: [],
  },
};

const RuntimeConfigContext = createContext<RuntimeConfig | undefined>(
  undefined,
);

const LOCAL_RUNTIME_CONFIG_PATH = "/isonia.config.local.json";
const RUNTIME_CONFIG_PATH = "/isonia.config.json";

export async function loadRuntimeConfig(configPath?: string): Promise<RuntimeConfig> {
  if (configPath) {
    return (
      (await tryLoadRuntimeConfigFile(configPath, {
        ignoreNotFound: false,
      })) ?? fallBackToDefaultRuntimeConfig()
    );
  }

  const localConfig = await tryLoadRuntimeConfigFile(
    LOCAL_RUNTIME_CONFIG_PATH,
    {
      ignoreNotFound: true,
    },
  );
  if (localConfig) {
    return localConfig;
  }

  const runtimeConfig = await tryLoadRuntimeConfigFile(RUNTIME_CONFIG_PATH, {
    ignoreNotFound: false,
  });
  return runtimeConfig ?? fallBackToDefaultRuntimeConfig();
}

async function tryLoadRuntimeConfigFile(
  configPath: string,
  options: { readonly ignoreNotFound: boolean },
): Promise<RuntimeConfig | undefined> {
  try {
    return await loadRuntimeConfigFile(configPath);
  } catch (error) {
    if (options.ignoreNotFound && isRuntimeConfigHttpError(error, 404)) {
      return undefined;
    }
    console.warn(
      `Unable to load IsoniaOS runtime config from ${configPath}.`,
      error,
    );
    return undefined;
  }
}

async function loadRuntimeConfigFile(configPath: string): Promise<RuntimeConfig> {
  const response = await fetch(configPath, { cache: "no-store" });
  return parseRuntimeConfigResponse(configPath, response);
}

async function parseRuntimeConfigResponse(
  configPath: string,
  response: Response,
): Promise<RuntimeConfig> {
  if (!response.ok) {
    throw new RuntimeConfigHttpError(configPath, response);
  }
  const value = (await response.json()) as unknown;
  return parseRuntimeConfig(value);
}

function fallBackToDefaultRuntimeConfig(): RuntimeConfig {
  console.warn("Falling back to default IsoniaOS runtime config.");
  return DEFAULT_RUNTIME_CONFIG;
}

class RuntimeConfigHttpError extends Error {
  readonly status: number;

  constructor(configPath: string, response: Response) {
    super(
      `Unable to fetch runtime config from ${configPath}: HTTP ${response.status} ${response.statusText}`,
    );
    this.name = "RuntimeConfigHttpError";
    this.status = response.status;
  }
}

function isRuntimeConfigHttpError(
  error: unknown,
  status: number,
): error is RuntimeConfigHttpError {
  return error instanceof RuntimeConfigHttpError && error.status === status;
}

export function RuntimeConfigProvider({
  config,
  children,
}: PropsWithChildren<{ readonly config: RuntimeConfig }>): JSX.Element {
  return (
    <RuntimeConfigContext.Provider value={config}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig(): RuntimeConfig {
  const config = useContext(RuntimeConfigContext);
  if (!config) {
    throw new Error("Runtime config is not available.");
  }
  return config;
}

function parseRuntimeConfig(value: unknown): RuntimeConfig {
  const object = asRecord(value);
  const contracts = asRecord(object.contracts);
  const features = asRecord(object.features);
  const theme = asRecord(object.theme);
  const metadata = asRecord(object.metadata);
  const wallet = asRecord(object.wallet);

  return {
    appName: readString(object.appName, DEFAULT_RUNTIME_CONFIG.appName),
    mode: readRuntimeMode(object.mode, DEFAULT_RUNTIME_CONFIG.mode),
    apiBaseUrl: readString(
      object.apiBaseUrl,
      DEFAULT_RUNTIME_CONFIG.apiBaseUrl,
    ),
    chainId: readRequiredNumber(
      object.chainId,
      DEFAULT_RUNTIME_CONFIG.chainId,
    ),
    chainName: readRequiredString(
      object.chainName,
      DEFAULT_RUNTIME_CONFIG.chainName,
    ),
    rpcUrl: readRequiredString(object.rpcUrl, DEFAULT_RUNTIME_CONFIG.rpcUrl),
    blockExplorerUrl: readOptionalString(object.blockExplorerUrl),
    nativeCurrencyName: readRequiredString(
      object.nativeCurrencyName,
      DEFAULT_RUNTIME_CONFIG.nativeCurrencyName,
    ),
    nativeCurrencySymbol: readRequiredString(
      object.nativeCurrencySymbol,
      DEFAULT_RUNTIME_CONFIG.nativeCurrencySymbol,
    ),
    contracts: {
      govCoreAddress: readAddress(
        firstDefined(
          contracts.govCoreAddress,
          object.govCoreAddress,
          contracts.govCore,
        ),
        DEFAULT_RUNTIME_CONFIG.contracts.govCoreAddress,
      ),
      govProposalsAddress: readAddress(
        firstDefined(
          contracts.govProposalsAddress,
          object.govProposalsAddress,
          contracts.govProposals,
        ),
        DEFAULT_RUNTIME_CONFIG.contracts.govProposalsAddress,
      ),
      demoTargetAddress: readOptionalAddress(
        firstDefined(
          contracts.demoTargetAddress,
          object.demoTargetAddress,
          contracts.demoTarget,
        ),
        DEFAULT_RUNTIME_CONFIG.contracts.demoTargetAddress,
      ),
    },
    features: {
      createProposal: readBoolean(
        features.createProposal,
        DEFAULT_RUNTIME_CONFIG.features.createProposal,
      ),
      writeActions: readBoolean(
        features.writeActions,
        DEFAULT_RUNTIME_CONFIG.features.writeActions,
      ),
      manageOrg: readBoolean(
        features.manageOrg,
        DEFAULT_RUNTIME_CONFIG.features.manageOrg,
      ),
      advancedAnalytics: readBoolean(
        features.advancedAnalytics,
        DEFAULT_RUNTIME_CONFIG.features.advancedAnalytics,
      ),
      billing: false,
      customTheme: readBoolean(
        features.customTheme,
        DEFAULT_RUNTIME_CONFIG.features.customTheme,
      ),
      saasAdmin: false,
    },
    theme: {
      source: readThemeSource(theme.source, DEFAULT_RUNTIME_CONFIG.theme.source),
      packageName: readOptionalString(theme.packageName),
    },
    metadata: {
      enabled: readBoolean(
        metadata.enabled,
        DEFAULT_RUNTIME_CONFIG.metadata.enabled,
      ),
      ipfsGatewayUrl: readString(
        metadata.ipfsGatewayUrl,
        DEFAULT_RUNTIME_CONFIG.metadata.ipfsGatewayUrl,
      ),
      timeoutMs: readPositiveInteger(
        metadata.timeoutMs,
        DEFAULT_RUNTIME_CONFIG.metadata.timeoutMs,
      ),
    },
    wallet: {
      reownProjectId: readString(
        wallet.reownProjectId,
        DEFAULT_RUNTIME_CONFIG.wallet.reownProjectId,
      ),
      appUrl: readString(wallet.appUrl, DEFAULT_RUNTIME_CONFIG.wallet.appUrl),
      icons: readStringArray(wallet.icons),
    },
  };
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

function readRequiredString(value: unknown, fallback: string): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_RUNTIME_CONFIG.wallet.icons;
  }
  return value.filter((item): item is string => typeof item === "string");
}

function readRequiredNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  const parsed = readRequiredNumber(value, fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readRuntimeMode(value: unknown, fallback: RuntimeMode): RuntimeMode {
  return value === "self-hosted" || value === "hosted-free" || value === "saas"
    ? value
    : fallback;
}

function readThemeSource(
  value: unknown,
  fallback: RuntimeThemeConfig["source"],
): RuntimeThemeConfig["source"] {
  return value === "default" || value === "package" || value === "runtime"
    ? value
    : fallback;
}

function readAddress(value: unknown, fallback: Address): Address {
  return isAddress(value) ? value : fallback;
}

function readOptionalAddress(
  value: unknown,
  fallback: Address | undefined,
): Address | undefined {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return isAddress(value) ? value : fallback;
}

function isAddress(value: unknown): value is Address {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}
