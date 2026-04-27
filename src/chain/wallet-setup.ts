import type { AppKitNetwork } from "@reown/appkit/networks";
import { defineChain as defineViemChain, type Chain } from "viem";
import { createConfig, http, type Config } from "wagmi";
import { injected } from "wagmi/connectors";
import type { RuntimeConfig } from "../config/runtime-config";

export interface WalletSetup {
  readonly appKitEnabled: boolean;
  readonly wagmiConfig: Config;
}

const initializedAppKitKeys = new Set<string>();

export async function createWalletSetup(
  runtimeConfig: RuntimeConfig,
): Promise<WalletSetup> {
  const wagmiChain = createConfiguredViemChain(runtimeConfig);
  const reownProjectId = runtimeConfig.wallet.reownProjectId.trim();

  if (reownProjectId.length > 0) {
    const [{ createAppKit }, { defineChain: defineAppKitChain }, adapterModule] =
      await Promise.all([
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
      wagmiConfig: wagmiAdapter.wagmiConfig,
    };
  }

  return {
    appKitEnabled: false,
    wagmiConfig: createConfig({
      chains: [wagmiChain] as [Chain, ...Chain[]],
      connectors: [injected()],
      transports: {
        [wagmiChain.id]: http(runtimeConfig.rpcUrl),
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
