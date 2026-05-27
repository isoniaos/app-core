import {
  createContext,
  type PropsWithChildren,
  useContext,
} from "react";
import type { RuntimeConfig } from "./runtime-config-loader";

export {
  loadRuntimeConfig,
  parseRuntimeConfig,
  parseRuntimeConfigFromEnv,
  selectRuntimeDeployment,
  type LoadRuntimeConfigOptions,
  type RuntimeConfig,
  type RuntimeConfigSource,
  type RuntimeConfigSourceKind,
  type RuntimeDeploymentConfig,
  type RuntimeEnv,
  type RuntimeFeatureFlags,
  type RuntimeMetadataConfig,
  type RuntimeProtocolContractsConfig,
  type RuntimeThemeConfig,
  type RuntimeWalletConfig,
  type RuntimeWalletMode,
} from "./runtime-config-loader";

const RuntimeConfigContext = createContext<RuntimeConfig | undefined>(
  undefined,
);

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
