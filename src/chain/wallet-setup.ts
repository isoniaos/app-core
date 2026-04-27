import type { AppKitNetwork } from "@reown/appkit/networks";
import { defineChain as defineViemChain, type Chain } from "viem";
import { createConfig, http, type Config } from "wagmi";
import { injected } from "wagmi/connectors";
import type { RuntimeConfig } from "../config/runtime-config";

export interface WalletSetup {
  readonly appKitEnabled: boolean;
  readonly diagnostics: readonly WalletSetupDiagnostic[];
  readonly wagmiConfig: Config;
}

export type WalletSetupDiagnosticLevel = "info" | "warning" | "error";

export type WalletSetupDiagnosticCode =
  | "invalid_chain_config"
  | "invalid_rpc_config"
  | "reown_init_failed"
  | "reown_project_id_missing";

export interface WalletSetupDiagnostic {
  readonly code: WalletSetupDiagnosticCode;
  readonly detail?: string;
  readonly level: WalletSetupDiagnosticLevel;
  readonly message: string;
}

export class WalletSetupError extends Error {
  readonly diagnostics: readonly WalletSetupDiagnostic[];

  constructor(
    message: string,
    diagnostics: readonly WalletSetupDiagnostic[],
  ) {
    super(message);
    this.name = "WalletSetupError";
    this.diagnostics = diagnostics;
  }
}

const initializedAppKitKeys = new Set<string>();

export async function createWalletSetup(
  runtimeConfig: RuntimeConfig,
): Promise<WalletSetup> {
  const configDiagnostics = validateWalletRuntimeConfig(runtimeConfig);
  if (configDiagnostics.length > 0) {
    throw new WalletSetupError(
      "Invalid wallet runtime config.",
      configDiagnostics,
    );
  }

  const wagmiChain = createConfiguredViemChain(runtimeConfig);
  const reownProjectId = runtimeConfig.wallet.reownProjectId.trim();

  if (reownProjectId.length > 0) {
    try {
      const [
        { createAppKit },
        { defineChain: defineAppKitChain },
        adapterModule,
      ] = await Promise.all([
        import("@reown/appkit/react"),
        import("@reown/appkit/networks"),
        import("@reown/appkit-adapter-wagmi"),
      ]);
      const appKitNetwork = createConfiguredAppKitNetwork(
        runtimeConfig,
        defineAppKitChain,
      );
      const networks = [appKitNetwork] as [AppKitNetwork, ...AppKitNetwork[]];
      const { WagmiAdapter } = adapterModule;
      const wagmiAdapter = new WagmiAdapter({
        networks,
        projectId: reownProjectId,
        ssr: false,
      });

      const setupKey = `${reownProjectId}:${runtimeConfig.chainId}`;
      if (!initializedAppKitKeys.has(setupKey)) {
        createAppKit({
          adapters: [wagmiAdapter],
          networks,
          projectId: reownProjectId,
          metadata: {
            name: runtimeConfig.appName,
            description: "IsoniaOS governance console",
            url: runtimeConfig.wallet.appUrl || getDefaultAppUrl(),
            icons: [...runtimeConfig.wallet.icons],
          },
          features: {
            analytics: false,
          },
        });
        initializedAppKitKeys.add(setupKey);
      }

      return {
        appKitEnabled: true,
        diagnostics: [],
        wagmiConfig: wagmiAdapter.wagmiConfig,
      };
    } catch (error) {
      const diagnostic: WalletSetupDiagnostic = {
        code: "reown_init_failed",
        detail: getErrorDetail(error),
        level: "error",
        message: "Reown AppKit failed; using injected wallet fallback.",
      };

      console.error(diagnostic.message, error);
      return createInjectedWalletSetup(wagmiChain, runtimeConfig.rpcUrl, [
        diagnostic,
      ]);
    }
  }

  const diagnostic: WalletSetupDiagnostic = {
    code: "reown_project_id_missing",
    level: "info",
    message: "Reown project ID missing; using injected wallet fallback.",
  };
  console.info(diagnostic.message);
  return createInjectedWalletSetup(wagmiChain, runtimeConfig.rpcUrl, [
    diagnostic,
  ]);
}

export function isWalletSetupError(error: unknown): error is WalletSetupError {
  return error instanceof WalletSetupError;
}

function createInjectedWalletSetup(
  wagmiChain: Chain,
  rpcUrl: string,
  diagnostics: readonly WalletSetupDiagnostic[],
): WalletSetup {
  return {
    appKitEnabled: false,
    diagnostics,
    wagmiConfig: createConfig({
      chains: [wagmiChain] as [Chain, ...Chain[]],
      connectors: [injected()],
      transports: {
        [wagmiChain.id]: http(rpcUrl),
      },
    }),
  };
}

function createConfiguredViemChain(runtimeConfig: RuntimeConfig): Chain {
  return defineViemChain(createChainCore(runtimeConfig));
}

function createConfiguredAppKitNetwork(
  runtimeConfig: RuntimeConfig,
  defineAppKitChain: typeof import("@reown/appkit/networks")["defineChain"],
): AppKitNetwork {
  const caipNetworkId: `eip155:${number}` = `eip155:${runtimeConfig.chainId}`;

  return defineAppKitChain({
    ...createChainCore(runtimeConfig),
    caipNetworkId,
    chainNamespace: "eip155",
  });
}

function createChainCore(runtimeConfig: RuntimeConfig): {
  readonly id: number;
  readonly name: string;
  readonly nativeCurrency: {
    readonly decimals: 18;
    readonly name: string;
    readonly symbol: string;
  };
  readonly rpcUrls: {
    readonly default: {
      readonly http: readonly [string];
    };
  };
  readonly blockExplorers:
    | {
        readonly default: {
          readonly name: string;
          readonly url: string;
        };
      }
    | undefined;
} {
  return {
    id: runtimeConfig.chainId,
    name: runtimeConfig.chainName,
    nativeCurrency: {
      decimals: 18,
      name: runtimeConfig.nativeCurrencyName,
      symbol: runtimeConfig.nativeCurrencySymbol,
    },
    rpcUrls: {
      default: {
        http: [runtimeConfig.rpcUrl],
      },
    },
    blockExplorers: runtimeConfig.blockExplorerUrl
      ? {
          default: {
            name: "Explorer",
            url: runtimeConfig.blockExplorerUrl,
          },
        }
      : undefined,
  };
}

function getDefaultAppUrl(): string {
  if (typeof window === "undefined") {
    return "http://localhost:5173";
  }
  return window.location.origin;
}

function validateWalletRuntimeConfig(
  runtimeConfig: RuntimeConfig,
): readonly WalletSetupDiagnostic[] {
  const diagnostics: WalletSetupDiagnostic[] = [];

  if (
    !Number.isSafeInteger(runtimeConfig.chainId) ||
    runtimeConfig.chainId <= 0
  ) {
    diagnostics.push({
      code: "invalid_chain_config",
      detail: `Received chainId: ${String(runtimeConfig.chainId)}`,
      level: "error",
      message:
        "Invalid chain config: chainId must be a positive safe integer.",
    });
  }

  if (runtimeConfig.chainName.trim().length === 0) {
    diagnostics.push({
      code: "invalid_chain_config",
      level: "error",
      message: "Invalid chain config: chainName is required.",
    });
  }

  if (runtimeConfig.nativeCurrencyName.trim().length === 0) {
    diagnostics.push({
      code: "invalid_chain_config",
      level: "error",
      message: "Invalid chain config: nativeCurrencyName is required.",
    });
  }

  if (runtimeConfig.nativeCurrencySymbol.trim().length === 0) {
    diagnostics.push({
      code: "invalid_chain_config",
      level: "error",
      message: "Invalid chain config: nativeCurrencySymbol is required.",
    });
  }

  if (!isHttpUrl(runtimeConfig.rpcUrl)) {
    diagnostics.push({
      code: "invalid_rpc_config",
      detail: `Received rpcUrl: ${runtimeConfig.rpcUrl}`,
      level: "error",
      message:
        "Invalid RPC config: rpcUrl must be an absolute http or https URL.",
    });
  }

  return diagnostics;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getErrorDetail(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}
